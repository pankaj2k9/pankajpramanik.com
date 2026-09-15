"use client";

import { useActionState } from "react";
import {
  createCertification,
  updateCertification,
  type CertFormState,
} from "@/actions/certifications";
import { FormError, SubmitButton, inputCls, labelCls } from "./ui";

type CertData = {
  id: string;
  title: string;
  issuer: string;
  url: string | null;
  order: number;
};

export default function CertificationForm({ cert }: { cert?: CertData }) {
  const action = cert
    ? updateCertification.bind(null, cert.id)
    : createCertification;
  const [state, formAction, pending] = useActionState<CertFormState, FormData>(
    action,
    undefined,
  );

  return (
    <form
      action={formAction}
      onReset={(event) => event.preventDefault()}
      className="max-w-2xl space-y-6"
    >
      <div>
        <label htmlFor="title" className={labelCls}>
          Title *
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={cert?.title}
          className={inputCls}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="issuer" className={labelCls}>
            Issuer * <span className="text-faint">(e.g. Coursera · IBM)</span>
          </label>
          <input
            id="issuer"
            name="issuer"
            required
            defaultValue={cert?.issuer}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="order" className={labelCls}>
            Order
          </label>
          <input
            id="order"
            name="order"
            type="number"
            defaultValue={cert?.order ?? 0}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="url" className={labelCls}>
          Certificate URL{" "}
          <span className="text-faint">(external verification link)</span>
        </label>
        <input
          id="url"
          name="url"
          type="url"
          defaultValue={cert?.url ?? ""}
          placeholder="https://www.coursera.org/account/accomplishments/…"
          className={inputCls}
        />
      </div>

      <FormError error={state?.error} />
      <SubmitButton pending={pending}>
        {cert ? "Update Certification" : "Create Certification"}
      </SubmitButton>
    </form>
  );
}
