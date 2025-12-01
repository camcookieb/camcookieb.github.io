// app.js — Backend server for Camcookie Archive

import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// --- MongoDB Atlas Connection ---
const uri = "mongodb+srv://Camcookiebooks:lBZpzB4dAE7Y6hgG@camcookiebooks.khchzhk.mongodb.net/?appName=CamcookieBooks";
const client = new MongoClient(uri);
let db;

async function connectDB() {
  await client.connect();
  db = client.db("camcookieArchive"); // your database name
  console.log("✅ Connected to MongoDB Atlas");
}
connectDB();

// --- USERS ---
app.get("/api/users/:username", async (req, res) => {
  const user = await db.collection("users").findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

app.put("/api/users/me", async (req, res) => {
  const { displayName, bio } = req.body;
  await db.collection("users").updateOne(
    { username: "Camcookie876" }, // placeholder for logged-in user
    { $set: { displayName, bio } }
  );
  res.json({ success: true });
});

// --- WORKS ---
app.get("/api/works", async (req, res) => {
  const { author } = req.query;
  const query = author ? { authorUsername: author } : {};
  const works = await db.collection("works").find(query).toArray();
  res.json(works);
});

app.get("/api/works/:id", async (req, res) => {
  const work = await db.collection("works").findOne({ _id: new ObjectId(req.params.id) });
  if (!work) return res.status(404).json({ error: "Work not found" });
  res.json(work);
});

app.post("/api/works", async (req, res) => {
  const { title, tags, chapters } = req.body;
  const work = {
    title,
    tags,
    chapters,
    authorUsername: "Camcookie876", // placeholder
    likes: 0,
    createdAt: new Date()
  };
  const result = await db.collection("works").insertOne(work);
  res.json({ success: true, id: result.insertedId });
});

app.post("/api/works/:id/like", async (req, res) => {
  await db.collection("works").updateOne(
    { _id: new ObjectId(req.params.id) },
    { $inc: { likes: 1 } }
  );
  res.json({ success: true });
});

app.delete("/api/works/:id", async (req, res) => {
  await db.collection("works").deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ success: true });
});

// --- BOOKMARKS ---
app.get("/api/bookmarks", async (req, res) => {
  const { user } = req.query;
  const bookmarks = await db.collection("bookmarks").find({ userId: user }).toArray();
  res.json(bookmarks);
});

app.post("/api/bookmarks", async (req, res) => {
  const { workId } = req.body;
  await db.collection("bookmarks").insertOne({
    userId: "Camcookie876", // placeholder
    workId,
    createdAt: new Date()
  });
  res.json({ success: true });
});

// --- COMMENTS ---
app.get("/api/comments", async (req, res) => {
  const { workId } = req.query;
  const comments = await db.collection("comments").find({ workId }).toArray();
  res.json(comments);
});

app.post("/api/comments", async (req, res) => {
  const { workId, content } = req.body;
  await db.collection("comments").insertOne({
    workId,
    userId: "Camcookie876", // placeholder
    content,
    createdAt: new Date()
  });
  res.json({ success: true });
});

// --- AUTH (GitHub OAuth placeholder) ---
app.post("/api/auth/github", async (req, res) => {
  const { code } = req.body;
  // Normally exchange code with GitHub API here
  res.json({ success: true, code });
});

// --- Start Server ---
app.listen(3000, () => console.log("🚀 Backend running on http://localhost:3000"));