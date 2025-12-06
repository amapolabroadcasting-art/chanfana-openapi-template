import { OpenAPIRoute } from "chanfana";
import type { Context } from "hono";

// src/endpoints/SendDemoEmail.ts
import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { Context } from "hono";
import type { Env } from "../worker-configuration";

type AppContext = Context<{ Bindings: Env }>;

export class SendDemoEmail extends OpenAPIRoute {
  schema = {
    tags: ["Email"],
    summary: "Send EDUCENTRA demo request via Gmail SMTP",
    requestBody: z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      institution: z.string(),
      role: z.string(),
      message: z.string().optional(),
    }),
    responses: {
      "200": {
        description: "Email sent",
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean() }),
          },
        },
      },
      "500": {
        description: "Error",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              error: z.string(),
            }),
          },
        },
      },
    },
  } as const;

  async handle(c: AppContext) {
    try {
      const { requestBody } = await this.getValidatedData<typeof this.schema>();
      const { name, email, phone, institution, role, message } = requestBody;

      // Quick sanity check of bindings
      console.log("SMTP_HOST", c.env.SMTP_HOST);
      console.log("SMTP_PORT", c.env.SMTP_PORT);
      console.log("SMTP_USERNAME", c.env.SMTP_USERNAME);

      const mailer = await WorkerMailer.connect({
        host: c.env.SMTP_HOST,
        port: Number(c.env.SMTP_PORT || "587"),
        secure: false,   // Gmail + 587 → STARTTLS
        startTls: true,
        authType: "plain",
        credentials: {
          username: c.env.SMTP_USERNAME,
          password: c.env.SMTP_PASSWORD,
        },
      });

      const html = `
        <h2>New Demo Request Received</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
        <p><strong>Institution:</strong> ${institution}</p>
        <p><strong>Role:</strong> ${role}</p>
        ${message ? `<p><strong>Message:</strong><br>${message}</p>` : ""}
      `;

      await mailer.send({
        from: { name: "EDUCENTRA Demo Requests", email: c.env.SMTP_USERNAME },
        to: { email: "partnerwithus@educentra.ai" },
        subject: `New Demo Request from ${name}`,
        html,
      });

      return c.json({ success: true });
    } catch (err: any) {
      console.error("SendDemoEmail error:", err);
      return c.json(
        {
          success: false,
          error: err?.message || String(err),
        },
        500
      );
    }
  }
}

