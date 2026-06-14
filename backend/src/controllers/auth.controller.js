const { getAuth, clerkClient } = require("@clerk/express");
const prisma = require("../config/prisma");

// Called from frontend after Clerk login.
// Returns existing DB record, or creates one if the user is missing (e.g. webhook missed).
const login = async (req, res, next) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId)
    return next(Object.assign(new Error("Unauthorized"), { statusCode: 401 }));

  try {
    let user = await prisma.user.findUnique({ where: { clerkId } });

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email)
        return next(
          Object.assign(new Error("No email on Clerk account"), {
            statusCode: 400,
          }),
        );

      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        null;

      user = await prisma.user.create({
        data: { clerkId, email, name, imageUrl: clerkUser.imageUrl || null },
      });
    }

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// Called from frontend after Clerk registration.
// Saves the new user to the database.
const register = async (req, res, next) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId)
    return next(Object.assign(new Error("Unauthorized"), { statusCode: 401 }));

  try {
    const clerkUser = await clerkClient.users.getUser(clerkId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email)
      return next(
        Object.assign(new Error("No email on Clerk account"), {
          statusCode: 400,
        }),
      );

    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      null;

    const user = await prisma.user.upsert({
      where: { clerkId },
      update: {},
      create: { clerkId, email, name, imageUrl: clerkUser.imageUrl || null },
    });

    res.status(201).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, register };
