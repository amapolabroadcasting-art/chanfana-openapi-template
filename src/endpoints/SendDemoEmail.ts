import { OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { WorkerMailer } from "worker-mailer";
import type { Env } from "../worker-configuration"; // adjust path if needed

export type AppContext = Context<{ Bindings: Env }>;

export class SendDemoEmail extends OpenAPIRoute {
  schema = {
    tags: ["Email"],
    summary: "Send EDUCENTRA demo request via SMTP",
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
            schema: z.object({
              success: z.boolean(),
            }),
          },
        },
      },
    },
  } as const;

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { name, email, phone, institution, role, message } = data.requestBody;

    const mailer = await WorkerMailer.connect({
      host: c.env.SMTP_HOST,
      port: Number(c.env.SMTP_PORT),
      secure: false,     // or true if you want pure TLS
      startTls: true,    // STARTTLS on 587
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
  }
}
