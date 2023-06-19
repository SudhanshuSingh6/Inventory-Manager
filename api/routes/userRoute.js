const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const auth = require("../middleware/authmiddleware");
const Token = require("../models/Token");
const crypto = require("crypto");
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("--password");
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});
router.post(
  "/register",
  [
    check("name", "Name is required").exists(),
    check("email", "Please enter a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, email, password } = req.body;
    try {
      let user = await User.findOne({ email: email });
      if (user) {
        return res.status(400).json({ errors: ["User already exists"] });
      }
      user = new User({
        name,
        email,
        password,
      });
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      await user.save();
      user.password = undefined;
      return res.status(201).json({ user });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ errors: ["Internal server error"] });
    }
  }
);
router.post(
  "/login",
  [
    check("email", "Please enter a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    try {
      let user = await User.findOne({ email: email });
      if (!user) {
        return res
          .status(400)
          .json({ errors: ["User not found, please sign up"] });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ errors: ["Invalid password"] });
      }
      const token = generateToken(user._id);
      res.status(200).json({ token: token });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ errors: ["Internal server error"] });
    }
  }
);
router.post("/updateuser", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (req.body.email) {
      let check = await User.findOne({ email: req.body.email });
      if (check) {
        if (check.id !== user.id) {
          return res.status(400).json({ errors: ["Email Taken"] });
        }
      }
    }
    const { email, name, phone, photo, bio } = user;
    user.name = req.body.name || name;
    user.email = req.body.email || email;
    user.photo = req.body.photo || photo;
    user.phone = req.body.phone || phone;
    user.bio = req.body.bio || bio;
    await user.save();
    user.password = undefined;
    res.status(200).json(user);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});
router.post(
  "/updatepassword",
  auth,
  [
    check("oldPassword", "Old Password is required").exists(),
    check("newPassword", "New Password is required").exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(400).json({ errors: ["User not found"] });
    }
    try {
      const { oldPassword, newPassword } = req.body;
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ errors: ["Old password is wrong"] });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();
      res.status(200).send("Password updated");
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
  }
);
router.get("/forgotPassword", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(400).json({ errors: ["User not found"] });
  }
  let resetToken = crypto.randomBytes(32).toString("hex") + user._id;
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  await new Token({
    userId: user._id,
    token: hashedToken,
    createAt: Date.now(),
    expiresAt: Date.now() + 30 * (60 * 1000),
  }).save();
  const resetUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;
  const message = `<h2>Hello ${user.name}</h2>
  <p>Please use the url below to reset your password</p>
  <p>This reset link is valid for only 30 minutes</p>
  <a href=${resetUrl}clicktracking=off>${resetUrl}</a>
  <p>Regards...</p>
  <p>Inventory Management</p>`;
  res.send("Forgot password");
  res.send("Forgot password");
});

module.exports = router;
