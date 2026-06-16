# Messages Empty State - Role-Specific Messaging

## TL;DR

> Arreglar el mensaje vacío en Messages para que muestre contenido diferente según el rol del usuario (owner vs walker).
> 
> **Owner**: "No tienes conversaciones. ¡Reserva tu primer paseo!"
> **Walker**: "No tienes conversaciones aún. Completa tu perfil y espera a que un dueño te contacte."
> 
> **Estimated Effort**: Quick (~10 min)
> **Parallel Execution**: NO
> **Critical Path**: Task 1 → Task 2

---

## Context

### Problema Actual
En `app/(tabs)/messages.tsx`, cuando no hay conversaciones, TODOS los usuarios ven el mismo mensaje:
> "Las conversaciones aparecerán cuando reserves un paseo. ¡Book tu primer paseo para empezar!"
> Botón: "Reservar un Paseo" → `/booking`

Esto está **incorrecto para walkers** porque:
- Un walker no reserva paseos, los **acepta**
- El mensaje y botón son confusos para walkers

### Investigación
- Web app no diferencia por rol en Messages.jsx (mismo mensaje genérico)
- Mobile app debe diferenciar para mejor UX
- El rol se obtiene de `user_profiles.role` ('owner' | 'walker' | 'admin')

---

## Work Objectives

### Core Objective
Mostrar mensajes contextuales según el rol del usuario en la pantalla de Messages vacía.

### Concrete Deliverables
1. Detectar el `role` del usuario logueado
2. Mensaje para **Owner**: "No tienes conversaciones. ¡Reserva tu primer paseo para empezar!"
3. Mensaje para **Walker**: "No tienes conversaciones aún. Completa tu perfil y espera a que un dueño te contacte."
4. Botón para Owner → `/booking`
5. Botón para Walker → `/walker-settings`

### Must Have
- Código funcione para ambos roles
- Fallback si no se puede obtener el rol (mostrar mensaje genérico)

---

## Verification Strategy

### QA Scenarios

```
Scenario: Owner sees correct empty state message
  Preconditions: Usuario logueado como owner, sin conversaciones
  Steps:
    1. Cerrar sesión y crear cuenta owner
    2. Ir a Messages tab
    3. Verificar que no hay conversaciones
  Expected Result: Mensaje dice "Reserva tu primer paseo", botón "Reservar un Paseo"
  Evidence: screenshot-messages-owner-empty.png

Scenario: Walker sees correct empty state message
  Preconditions: Usuario logueado como walker, sin conversaciones
  Steps:
    1. Cerrar sesión y crear cuenta walker
    2. Ir a Messages tab
    3. Verificar que no hay conversaciones
  Expected Result: Mensaje dice "Completa tu perfil", botón "Configurar Perfil"
  Evidence: screenshot-messages-walker-empty.png
```

---

## Execution Strategy

```
Wave 1 (Simple change):
└── Task 1: Add user role detection + conditional empty state
```

---

## TODOs

- [x] 1. **Add role detection and conditional empty state in messages.tsx**

  **What to do**:
  - Add `userRole` state variable
  - In `fetchCurrentUser`, also fetch `user_profiles.role`
  - Add conditional rendering for empty state based on role

  **Code changes in `app/(tabs)/messages.tsx`**:

  1. Add state (line ~25):
  ```typescript
  const [userRole, setUserRole] = useState<string | null>(null);
  ```

  2. Update `fetchCurrentUser` function (~line 37):
  ```typescript
  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        setUserRole(profile?.role || null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };
  ```

  3. Update empty state conditional (~line 143-150):
  ```typescript
  {loading ? (
    <SkeletonList count={5} />
  ) : conversations.length === 0 ? (
    userRole === 'walker' ? (
      <EmptyState
        icon={<MessageSquare size={36} color="#13ec13" />}
        title="No tienes conversaciones"
        description="Completa tu perfil y espera a que un dueño te contacte para empezar a pasear."
        actionLabel="Configurar Perfil"
        onAction={() => router.push('/walker-settings')}
      />
    ) : (
      <EmptyState
        icon={<MessageSquare size={36} color="#13ec13" />}
        title="No tienes conversaciones"
        description="Las conversaciones aparecerán cuando reserves un paseo. ¡Reserva tu primer paseo para empezar!"
        actionLabel="Reservar un Paseo"
        onAction={() => router.push('/booking')}
      />
    )
  ) : (
  ```

  **Must NOT do**:
  - No cambiar la lógica de carga de conversaciones
  - No modificar otros archivos

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Simple state addition and conditional rendering

  **References**:
  - `app/(tabs)/messages.tsx:37-45` - current fetchCurrentUser function
  - `app/(tabs)/messages.tsx:143-150` - current empty state
  - `app/walker-settings.tsx` - destination for walker button

  **Acceptance Criteria**:
  - [x] Owner sees "Reservar un Paseo" button → `/booking`
  - [x] Walker sees "Configurar Perfil" button → `/walker-settings`
  - [x] If role cannot be determined, show owner message (fallback)

---

## Final Verification Wave

- [x] F1. **Type check** - Run `npx tsc --noEmit` to verify no errors

---

## Commit Strategy

- **1**: `fix(messages): show role-specific empty state message`

---

## Success Criteria

- [x] Owner empty state: "Reservar un Paseo" → `/booking`
- [x] Walker empty state: "Configurar Perfil" → `/walker-settings`
- [x] Code compiles without errors