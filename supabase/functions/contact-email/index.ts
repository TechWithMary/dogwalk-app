import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend@1.0.0'
import { corsHeaders } from '../_shared/cors.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const resend = new Resend(RESEND_API_KEY)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, htmlContent } = await req.json()

    if (!to || !subject || !htmlContent) {
      throw new Error('"to", "subject", and "htmlContent" are required.')
    }

    const { data, error } = await resend.emails.send({
      from: 'PaseoMundo <hola@tu-dominio-verificado.com>', // CAMBIA ESTO
      to: [to],
      subject: subject,
      html: htmlContent,
    })

    if (error) {
      console.error({ error })
      return new Response(JSON.stringify(error), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
