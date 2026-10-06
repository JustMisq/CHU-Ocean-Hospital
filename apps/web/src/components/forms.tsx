"use client";

import { createContext, useActionState, useContext, useEffect, useRef, startTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { TriangleAlert } from "lucide-react";

export type FormState = { error?: string; ok?: string } | undefined;

const PendingContext = createContext(false);

export function SubmitButton({ children, className = "btn-primary", pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending: formPending } = useFormStatus();
  const pending = useContext(PendingContext) || formPending;
  return (
    <button className={className} disabled={pending}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/**
 * Formulaire branché sur une server action qui renvoie `{ error }` ou `{ ok }`.
 * Contrairement à `<form action>`, les champs ne sont pas vidés en cas d'erreur
 * (React 19 réinitialise sinon le formulaire après chaque envoi).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (state: FormState, data: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(data));
      }}
    >
      {state?.error && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}
      {state?.ok && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{state.ok}</p>}
      <PendingContext value={pending}>{children}</PendingContext>
    </form>
  );
}

/** Bouton d'action destructive avec confirmation navigateur. */
export function ConfirmButton({ children, message, className = "btn-danger" }: { children: ReactNode; message: string; className?: string }) {
  const { pending: formPending } = useFormStatus();
  const pending = useContext(PendingContext) || formPending;
  return (
    <button
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
