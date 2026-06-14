const { getAuth } = require("@clerk/express");
const prisma = require("../config/prisma");

const getMe = async (req, res, next) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) return next(Object.assign(new Error("Unauthorized"), { statusCode: 401 }));

  try {
    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return next(Object.assign(new Error("User not found"), { statusCode: 404 }));
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) return next(Object.assign(new Error("Unauthorized"), { statusCode: 401 }));

  const { name, birthDate, address } = req.body;

  const data = {};
  if (name !== undefined) data.name = name;
  if (address !== undefined) data.address = address;
  if (birthDate !== undefined) data.birthDate = birthDate ? new Date(birthDate) : null;
  if (req.file) data.imageUrl = req.file.path;

  try {
    const user = await prisma.user.update({
      where: { clerkId },
      data,
    });
    res.json({ success: true, user });
  } catch (err) {
    if (err.code === "P2025") {
      return next(Object.assign(new Error("User not found"), { statusCode: 404 }));
    }
    next(err);
  }
};

module.exports = { getMe, updateProfile };
