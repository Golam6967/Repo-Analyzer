const { Webhook } = require("svix");
const prisma = require("../config/prisma");

const handleClerkWebhook = async (req, res, next) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return next(Object.assign(new Error("CLERK_WEBHOOK_SECRET not set"), { statusCode: 500 }));
  }

  const wh = new Webhook(secret);
  let evt;

  try {
    evt = wh.verify(JSON.stringify(req.body), {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });
  } catch {
    return next(Object.assign(new Error("Invalid webhook signature"), { statusCode: 400 }));
  }

  const { type, data } = evt;

  if (type === "user.created") {
    const email = data.email_addresses?.[0]?.email_address;
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

    await prisma.user.upsert({
      where: { clerkId: data.id },
      update: { email, name, imageUrl: data.image_url || null },
      create: { clerkId: data.id, email, name, imageUrl: data.image_url || null },
    });
  }

  if (type === "user.updated") {
    const email = data.email_addresses?.[0]?.email_address;
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

    await prisma.user.update({
      where: { clerkId: data.id },
      data: { email, name, imageUrl: data.image_url || null },
    });
  }

  if (type === "user.deleted") {
    await prisma.user.delete({ where: { clerkId: data.id } }).catch(() => {});
  }

  res.status(200).json({ received: true });
};

module.exports = { handleClerkWebhook };
