


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_booking"("booking_id_param" bigint, "walker_id_param" bigint) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  updated_rows int;
BEGIN
  -- Intentamos actualizar la reserva SOLO SI sigue en estado 'pending'
  UPDATE public.bookings
  SET
    status = 'accepted',
    walker_id = walker_id_param
  WHERE
    id = booking_id_param AND status = 'pending';
  -- La variable `FOUND` nos dice si la fila fue realmente actualizada
  IF FOUND THEN
    -- Si se actualizó, significa que ganamos la "carrera"
    RETURN true;
  ELSE
    -- Si no se actualizó, es porque otro paseador la tomó.
    RETURN false;
  END IF;
END;
$$;


ALTER FUNCTION "public"."accept_booking"("booking_id_param" bigint, "walker_id_param" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_accepted_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  walker_profile RECORD;
BEGIN
  -- Obtener el nombre del paseador
  SELECT u.first_name INTO walker_profile
  FROM public.walkers w
  JOIN public.user_profiles u ON w.user_id = u.user_id
  WHERE w.id = NEW.walker_id;
  -- Insertar una notificación para el dueño de la reserva
  INSERT INTO public.notifications (user_id, title, body, link_to)
  VALUES (
    NEW.user_id,
    '¡Tu paseo ha sido aceptado!',
    walker_profile.first_name || ' está en camino de pasear a tu mascota.',
    '/booking/' || NEW.id -- Enlace para ver los detalles de la reserva
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_booking_accepted_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_walker_from_auth"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
begin
  -- Verificamos si en los datos del registro dice que es 'walker'
  -- (Supabase guarda esto en 'raw_user_meta_data')
  if (new.raw_user_meta_data->>'role') = 'walker' then
    insert into public.walkers (user_id, name, location, price, rating, reviews, img)
    values (
      new.id, -- El ID real del usuario
      COALESCE(new.raw_user_meta_data->>'name', 'Paseador Nuevo'), -- Nombre
      'Medellín',
      '$20.000',
      5.0,
      0,
      'https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=Paseador'
    );
  end if;
  return new;
end;
$_$;


ALTER FUNCTION "public"."create_walker_from_auth"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "address" "text",
    "duration" "text",
    "total_price" numeric,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "lat" double precision,
    "lng" double precision,
    "scheduled_date" "text",
    "scheduled_time" "text",
    "rating" integer,
    "review_text" "text",
    "walker_id" bigint,
    "service_type" "text" DEFAULT 'regular_walk'::"text",
    "special_instructions" "text",
    "walker_notes" "text",
    "owner_notes" "text",
    "photos_taken" "jsonb" DEFAULT '[]'::"jsonb",
    "walk_start_time" timestamp with time zone,
    "walk_end_time" timestamp with time zone,
    "actual_duration_minutes" integer,
    "route_data" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "bookings_service_type_check" CHECK (("service_type" = ANY (ARRAY['regular_walk'::"text", 'extended_walk'::"text", 'group_walk'::"text", 'puppy_care'::"text", 'elderly_care'::"text", 'special_needs'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_bookings_for_walker"("walker_id_param" bigint) RETURNS SETOF "public"."bookings"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    walker_profile RECORD;
BEGIN
    -- 1. Obtener el perfil del paseador que está consultando
    SELECT service_latitude, service_longitude, service_radius_km, is_verified
    INTO walker_profile
    FROM public.walkers
    WHERE id = walker_id_param;
    -- Si no encontramos el perfil o no está verificado, no devolvemos nada
    IF NOT FOUND OR walker_profile.is_verified IS NOT TRUE THEN
        RETURN;
    END IF;
    -- 2. Devolvemos los bookings que cumplen con los criterios
    RETURN QUERY
    SELECT b.*
    FROM public.bookings AS b
    WHERE
        -- Criterio 1: El booking debe estar pendiente
        b.status = 'pending'
        -- Criterio 2: La ubicación del booking debe estar dentro de la zona de servicio del paseador
        AND ST_DWithin(
            ST_MakePoint(b.lng, b.lat)::geography,
            ST_MakePoint(walker_profile.service_longitude, walker_profile.service_latitude)::geography,
            walker_profile.service_radius_km * 1000
        )
        -- Criterio 3: El paseador debe estar disponible (Lógica condicional)
        AND (
            -- CASO A: Es un paseo PROGRAMADO (tiene fecha)
            (b.scheduled_date IS NOT NULL AND EXISTS (
                SELECT 1
                FROM public.walker_availability wa
                WHERE
                    wa.walker_id = walker_id_param
                    AND wa.day_of_week = EXTRACT(DOW FROM b.scheduled_date::date)
                    AND b.scheduled_time::time BETWEEN wa.start_time AND wa.end_time
            ))
            OR
            -- CASO B: Es un paseo INMEDIATO (no tiene fecha)
            (b.scheduled_date IS NULL AND EXISTS (
                SELECT 1
                FROM public.walker_availability wa
                WHERE
                    wa.walker_id = walker_id_param
                    -- Revisa la disponibilidad para el día y la hora ACTUAL
                    AND wa.day_of_week = EXTRACT(DOW FROM now())
                    AND now()::time BETWEEN wa.start_time AND wa.end_time
            ))
        );
END;
$$;


ALTER FUNCTION "public"."get_pending_bookings_for_walker"("walker_id_param" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_walker_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  target_walker_id bigint;
BEGIN
  -- Encontrar el walker_id a través de la reserva asociada a la nueva reseña
  SELECT walker_id INTO target_walker_id
  FROM public.bookings
  WHERE id = NEW.booking_id;
  -- Si la reserva tenía un paseador asignado, actualizar sus estadísticas
  IF target_walker_id IS NOT NULL THEN
    UPDATE public.walkers
    SET
      rating = (
        -- Calcular el nuevo promedio de calificación
        SELECT AVG(r.rating)
        FROM public.booking_reviews r
        JOIN public.bookings b ON r.booking_id = b.id
        WHERE b.walker_id = target_walker_id AND r.rating IS NOT NULL
      ),
      reviews = (
        -- Contar el número total de reseñas
        SELECT COUNT(*)
        FROM public.booking_reviews r
        JOIN public.bookings b ON r.booking_id = b.id
        WHERE b.walker_id = target_walker_id
      )
    WHERE id = target_walker_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_walker_stats"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" bigint,
    "reviewer_id" "uuid",
    "reviewee_id" "uuid",
    "rating" integer,
    "comment" "text",
    "punctuality_rating" integer,
    "communication_rating" integer,
    "care_rating" integer,
    "overall_experience_rating" integer,
    "would_recommend" boolean,
    "public_response" "text",
    "is_public" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "booking_reviews_care_rating_check" CHECK ((("care_rating" >= 1) AND ("care_rating" <= 5))),
    CONSTRAINT "booking_reviews_communication_rating_check" CHECK ((("communication_rating" >= 1) AND ("communication_rating" <= 5))),
    CONSTRAINT "booking_reviews_overall_experience_rating_check" CHECK ((("overall_experience_rating" >= 1) AND ("overall_experience_rating" <= 5))),
    CONSTRAINT "booking_reviews_punctuality_rating_check" CHECK ((("punctuality_rating" >= 1) AND ("punctuality_rating" <= 5))),
    CONSTRAINT "booking_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."booking_reviews" OWNER TO "postgres";


ALTER TABLE "public"."bookings" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."bookings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_one_id" "uuid",
    "participant_two_id" "uuid",
    "booking_id" bigint,
    "last_message_id" "uuid",
    "last_message_at" timestamp with time zone,
    "participant_one_unread_count" integer DEFAULT 0,
    "participant_two_unread_count" integer DEFAULT 0,
    "is_archived_by_participant_one" boolean DEFAULT false,
    "is_archived_by_participant_two" boolean DEFAULT false,
    "is_blocked_by_participant_one" boolean DEFAULT false,
    "is_blocked_by_participant_two" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" bigint,
    "walker_id" bigint,
    "latitude" numeric(10,8) NOT NULL,
    "longitude" numeric(11,8) NOT NULL,
    "altitude" numeric(8,2),
    "accuracy" numeric(5,2),
    "speed" numeric(5,2),
    "heading" numeric(5,2),
    "activity_type" "text" DEFAULT 'walking'::"text",
    "timestamp" timestamp with time zone NOT NULL,
    "battery_level" integer,
    "signal_strength" "text",
    "location_source" "text" DEFAULT 'gps'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "locations_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['stationary'::"text", 'walking'::"text", 'running'::"text", 'driving'::"text", 'cycling'::"text"]))),
    CONSTRAINT "locations_battery_level_check" CHECK ((("battery_level" >= 0) AND ("battery_level" <= 100))),
    CONSTRAINT "locations_location_source_check" CHECK (("location_source" = ANY (ARRAY['gps'::"text", 'network'::"text", 'passive'::"text", 'manual'::"text"]))),
    CONSTRAINT "locations_signal_strength_check" CHECK (("signal_strength" = ANY (ARRAY['excellent'::"text", 'good'::"text", 'fair'::"text", 'poor'::"text", 'none'::"text"])))
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "sender_id" "uuid",
    "receiver_id" "uuid",
    "message_text" "text",
    "message_type" "text" DEFAULT 'text'::"text",
    "media_url" "text",
    "media_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "location_data" "jsonb" DEFAULT '{}'::"jsonb",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "is_edited" boolean DEFAULT false,
    "edited_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'image'::"text", 'location'::"text", 'file'::"text", 'system_notification'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "link_to" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "walker_id" bigint NOT NULL,
    "amount" numeric NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "payout_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "transaction_ids" "uuid"[],
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "name" "text" NOT NULL,
    "breed" "text",
    "age_years" integer,
    "age_months" integer,
    "weight_kg" numeric(5,2),
    "gender" "text",
    "size" "text",
    "is_neutered" boolean DEFAULT false,
    "energy_level" "text",
    "special_needs" "text",
    "behavioral_notes" "text",
    "medical_conditions" "text",
    "allergies" "text",
    "vet_info" "jsonb" DEFAULT '{}'::"jsonb",
    "favorite_activities" "text"[],
    "fears" "text"[],
    "photos" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pets_energy_level_check" CHECK (("energy_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "pets_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text"]))),
    CONSTRAINT "pets_size_check" CHECK (("size" = ANY (ARRAY['small'::"text", 'medium'::"text", 'large'::"text", 'giant'::"text"])))
);


ALTER TABLE "public"."pets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."problematic_bookings" AS
 SELECT "id",
    "user_id",
    "address",
    "duration",
    "total_price",
    "status",
    "created_at",
    "lat",
    "lng",
    "scheduled_date",
    "scheduled_time",
    "rating",
    "review_text",
    "walker_id",
    "service_type",
    "special_instructions",
    "walker_notes",
    "owner_notes",
    "photos_taken",
    "walk_start_time",
    "walk_end_time",
    "actual_duration_minutes",
    "route_data",
    "updated_at"
   FROM "public"."bookings"
  WHERE (("status" = ANY (ARRAY['pending'::"text", 'failed'::"text", 'cancelled'::"text"])) AND ("created_at" < ("now"() - '1 day'::interval)));


ALTER VIEW "public"."problematic_bookings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."recent_bookings" AS
 SELECT "id",
    "user_id",
    "address",
    "duration",
    "total_price",
    "status",
    "created_at",
    "lat",
    "lng",
    "scheduled_date",
    "scheduled_time",
    "rating",
    "review_text",
    "walker_id",
    "service_type",
    "special_instructions",
    "walker_notes",
    "owner_notes",
    "photos_taken",
    "walk_start_time",
    "walk_end_time",
    "actual_duration_minutes",
    "route_data",
    "updated_at"
   FROM "public"."bookings"
  WHERE ("created_at" >= ("now"() - '7 days'::interval));


ALTER VIEW "public"."recent_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_number" "text" DEFAULT ((('TX-'::"text" || "to_char"("now"(), 'YYYYMMDD'::"text")) || '-'::"text") || "lpad"(("floor"(("random"() * (10000)::double precision)))::"text", 4, '0'::"text")) NOT NULL,
    "user_id" "uuid",
    "booking_id" bigint,
    "transaction_type" "text" NOT NULL,
    "amount" integer NOT NULL,
    "fee_amount" integer DEFAULT 0,
    "net_amount" integer,
    "currency" "text" DEFAULT 'COP'::"text",
    "payment_method" "text",
    "payment_gateway" "text",
    "gateway_transaction_id" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "platform_fee" numeric,
    "net_earning" numeric,
    CONSTRAINT "transactions_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'credit_card'::"text", 'debit_card'::"text", 'nequi'::"text", 'davivienda'::"text", 'pse'::"text", 'wallet'::"text"]))),
    CONSTRAINT "transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text", 'refunded'::"text"]))),
    CONSTRAINT "transactions_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['payment'::"text", 'refund'::"text", 'deposit'::"text", 'withdrawal'::"text", 'penalty'::"text", 'bonus'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "phone" "text",
    "profile_photo_url" "text",
    "role" "text" NOT NULL,
    "is_profile_complete" boolean DEFAULT false,
    "date_of_birth" "date",
    "gender" "text",
    "notification_preferences" "jsonb" DEFAULT '{"sms": false, "push": true, "email": true}'::"jsonb",
    "language" "text" DEFAULT 'es'::"text",
    "timezone" "text" DEFAULT 'America/Bogota'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_profiles_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'other'::"text", 'prefer_not_to_say'::"text"]))),
    CONSTRAINT "user_profiles_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'walker'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."walker_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "walker_id" bigint NOT NULL,
    "day_of_week" smallint NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "walker_availability_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."walker_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."walker_certifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "walker_id" bigint,
    "certification_type" "text" NOT NULL,
    "certification_name" "text" NOT NULL,
    "issuing_organization" "text",
    "certificate_number" "text",
    "issue_date" "date",
    "expiry_date" "date",
    "certificate_url" "text",
    "is_verified" boolean DEFAULT false,
    "verification_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "walker_certifications_certification_type_check" CHECK (("certification_type" = ANY (ARRAY['pet_first_aid'::"text", 'dog_training'::"text", 'professional_walker'::"text", 'insurance'::"text", 'background_check'::"text"])))
);


ALTER TABLE "public"."walker_certifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."walkers" (
    "id" bigint NOT NULL,
    "name" "text",
    "location" "text",
    "rating" numeric,
    "reviews" integer,
    "price" numeric(10,2),
    "img" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "user_id" "uuid",
    "service_latitude" double precision,
    "service_longitude" double precision,
    "service_radius_km" integer,
    "is_verified" boolean DEFAULT false
);


ALTER TABLE "public"."walkers" OWNER TO "postgres";


ALTER TABLE "public"."walkers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."walkers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."booking_reviews"
    ADD CONSTRAINT "booking_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_transaction_number_key" UNIQUE ("transaction_number");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."walker_availability"
    ADD CONSTRAINT "walker_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."walker_availability"
    ADD CONSTRAINT "walker_availability_unique_slot" UNIQUE ("walker_id", "day_of_week", "start_time", "end_time");



ALTER TABLE ONLY "public"."walker_certifications"
    ADD CONSTRAINT "walker_certifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."walkers"
    ADD CONSTRAINT "walkers_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "on_booking_accepted" AFTER UPDATE OF "status" ON "public"."bookings" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM 'accepted'::"text") AND ("new"."status" = 'accepted'::"text"))) EXECUTE FUNCTION "public"."create_booking_accepted_notification"();



CREATE OR REPLACE TRIGGER "on_new_review" AFTER INSERT ON "public"."booking_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_walker_stats"();



ALTER TABLE ONLY "public"."booking_reviews"
    ADD CONSTRAINT "booking_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_reviews"
    ADD CONSTRAINT "booking_reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_reviews"
    ADD CONSTRAINT "booking_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_walker_id_fkey" FOREIGN KEY ("walker_id") REFERENCES "public"."walkers"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_one_id_fkey" FOREIGN KEY ("participant_one_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_two_id_fkey" FOREIGN KEY ("participant_two_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_walker_id_fkey" FOREIGN KEY ("walker_id") REFERENCES "public"."walkers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_walker_id_fkey" FOREIGN KEY ("walker_id") REFERENCES "public"."walkers"("id");



ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."walker_availability"
    ADD CONSTRAINT "walker_availability_walker_id_fkey" FOREIGN KEY ("walker_id") REFERENCES "public"."walkers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."walker_certifications"
    ADD CONSTRAINT "walker_certifications_walker_id_fkey" FOREIGN KEY ("walker_id") REFERENCES "public"."walkers"("id") ON DELETE CASCADE;



CREATE POLICY "Cualquiera puede ver paseadores" ON "public"."walkers" FOR SELECT USING (true);



CREATE POLICY "Owner and walker can update their bookings" ON "public"."bookings" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."walkers"
  WHERE (("walkers"."id" = "bookings"."walker_id") AND ("walkers"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Owner and walker can view their bookings" ON "public"."bookings" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."walkers"
  WHERE (("walkers"."id" = "bookings"."walker_id") AND ("walkers"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Owners can create bookings for themselves" ON "public"."bookings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Public can view walkers" ON "public"."walkers" FOR SELECT USING (true);



CREATE POLICY "Users can access messages in their conversations" ON "public"."messages" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND (("conversations"."participant_one_id" = "auth"."uid"()) OR ("conversations"."participant_two_id" = "auth"."uid"()))))));



CREATE POLICY "Users can access their own conversations" ON "public"."conversations" USING ((("auth"."uid"() = "participant_one_id") OR ("auth"."uid"() = "participant_two_id")));



CREATE POLICY "Users can manage their own pets" ON "public"."pets" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage their own profiles" ON "public"."user_profiles" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuarios pueden crear reservas" ON "public"."bookings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuarios pueden ver sus propias reservas" ON "public"."bookings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Walkers can manage their own certifications" ON "public"."walker_certifications" USING ((EXISTS ( SELECT 1
   FROM "public"."walkers"
  WHERE (("walkers"."id" = "walker_certifications"."walker_id") AND ("walkers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Walkers can update their own profile" ON "public"."walkers" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."walker_certifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."walkers" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bookings";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."accept_booking"("booking_id_param" bigint, "walker_id_param" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."accept_booking"("booking_id_param" bigint, "walker_id_param" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_booking"("booking_id_param" bigint, "walker_id_param" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_accepted_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_accepted_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_accepted_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_walker_from_auth"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_walker_from_auth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_walker_from_auth"() TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_bookings_for_walker"("walker_id_param" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_bookings_for_walker"("walker_id_param" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_bookings_for_walker"("walker_id_param" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_walker_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_walker_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_walker_stats"() TO "service_role";


















GRANT ALL ON TABLE "public"."booking_reviews" TO "anon";
GRANT ALL ON TABLE "public"."booking_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_reviews" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bookings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bookings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bookings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."payouts" TO "anon";
GRANT ALL ON TABLE "public"."payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts" TO "service_role";



GRANT ALL ON TABLE "public"."pets" TO "anon";
GRANT ALL ON TABLE "public"."pets" TO "authenticated";
GRANT ALL ON TABLE "public"."pets" TO "service_role";



GRANT ALL ON TABLE "public"."problematic_bookings" TO "anon";
GRANT ALL ON TABLE "public"."problematic_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."problematic_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."recent_bookings" TO "anon";
GRANT ALL ON TABLE "public"."recent_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."recent_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."walker_availability" TO "anon";
GRANT ALL ON TABLE "public"."walker_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."walker_availability" TO "service_role";



GRANT ALL ON TABLE "public"."walker_certifications" TO "anon";
GRANT ALL ON TABLE "public"."walker_certifications" TO "authenticated";
GRANT ALL ON TABLE "public"."walker_certifications" TO "service_role";



GRANT ALL ON TABLE "public"."walkers" TO "anon";
GRANT ALL ON TABLE "public"."walkers" TO "authenticated";
GRANT ALL ON TABLE "public"."walkers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."walkers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."walkers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."walkers_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_walker_from_auth();


