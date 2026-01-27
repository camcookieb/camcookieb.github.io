// ==============================
// Supabase Setup
// ==============================
const supabaseUrl = "https://ymwxloupuzayoplcqauy.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inltd3hsb3VwdXpheW9wbGNxYXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MjAyNTIsImV4cCI6MjA4NTA5NjI1Mn0.O57Si_GpdCQJc9Xm52PE3L1yT_D2PEWheGwVkxXe0yY";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==============================
// Basic SPA Router
// ==============================
const app = document.getElementById("app");
const authStatusEl = document.getElementById("auth-status");

function navigate(path) {
  history.pushState({}, "", path);
  router();
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-link]");
  if (link) {
    e.preventDefault();
    navigate(link.getAttribute("href"));
  }
});

window.addEventListener("popstate", router);

// ==============================
// Auth helpers
// ==============================
async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

async function updateAuthStatus() {
  const user = await getCurrentUser();
  if (!user) {
    authStatusEl.innerHTML = `
      <button class="btn-outline btn-sm" id="login-btn">Log in</button>
    `;
  } else {
    authStatusEl.innerHTML = `
      <span class="inline-meta">Signed in as ${user.email}</span>
      <button class="btn-outline btn-sm" id="logout-btn">Log out</button>
    `;
  }

  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  if (loginBtn) {
    loginBtn.addEventListener("click", () => navigate("/login"));
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      await updateAuthStatus();
      navigate("/");
    });
  }
}

// ==============================
// Router
// ==============================
async function router() {
  await updateAuthStatus();

  const path = sessionStorage.redirect || location.pathname;
  sessionStorage.removeItem("redirect");

  if (path === "/") return renderHome();
  if (path === "/stories") return renderStoryList();
  if (path.startsWith("/story/")) {
    const id = path.split("/")[2];
    return renderStory(id);
  }
  if (path === "/collections") return renderCollectionList();
  if (path.startsWith("/collection/")) {
    const id = path.split("/")[2];
    return renderCollection(id);
  }
  if (path === "/explore") return renderExplore();
  if (path.startsWith("/profile/")) {
    const id = path.split("/")[2];
    return renderProfile(id);
  }
  if (path === "/profile") return renderMyProfile();
  if (path === "/login") return renderLogin();

  app.innerHTML = `<h2>Not found</h2><p>This page does not exist.</p>`;
}

// ==============================
// Page: Login
// ==============================
async function renderLogin() {
  const user = await getCurrentUser();
  if (user) {
    navigate("/");
    return;
  }

  app.innerHTML = `
    <h2>Log in</h2>
    <div class="card">
      <form id="login-form">
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" required>
        </div>
        <button class="btn" type="submit">Log in</button>
      </form>
      <p class="inline-meta">If the account does not exist, it will be created.</p>
    </div>
  `;

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value.trim();
    const password = form.password.value;

    // Try sign in, if fails, sign up
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        alert("Error: " + signUpError.message);
        return;
      }
    }

    await updateAuthStatus();
    navigate("/profile");
  });
}

// ==============================
// Page: Home (Feed)
// ==============================
async function renderHome() {
  const user = await getCurrentUser();

  app.innerHTML = `
    <h2>Home Feed</h2>
    ${user ? `
      <div class="card">
        <h3>Create a post</h3>
        <form id="post-form">
          <div class="form-group">
            <label>Content</label>
            <textarea name="content" required></textarea>
          </div>
          <button class="btn" type="submit">Post</button>
        </form>
      </div>
    ` : `
      <div class="card">
        <p>You’re not logged in. <a href="/login" data-link>Log in</a> to post.</p>
      </div>
    `}
    <div id="feed"></div>
  `;

  if (user) {
    document.getElementById("post-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const content = e.target.content.value.trim();
      if (!content) return;
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content,
      });
      if (error) {
        alert("Error creating post: " + error.message);
        return;
      }
      e.target.reset();
      renderHome(); // reload feed
    });
  }

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, content, created_at, author_id, profiles(username)")
    .order("created_at", { ascending: false });

  if (error) {
    document.getElementById("feed").innerHTML = `<p>Error loading feed.</p>`;
    return;
  }

  const feedEl = document.getElementById("feed");
  feedEl.innerHTML = "";

  for (const p of posts) {
    const likeCount = await getLikeCount("post", p.id);
    const comments = await getComments("post", p.id);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-header">
        <div>
          <span class="card-title">
            <a href="/profile/${p.author_id}" data-link>${p.profiles?.username || "Unknown"}</a>
          </span>
          <div class="card-meta">${new Date(p.created_at).toLocaleString()}</div>
        </div>
      </div>
      <div>${escapeHtml(p.content).replace(/\n/g, "<br>")}</div>
      <div style="margin-top:8px;">
        <button class="btn-outline btn-sm like-btn" data-type="post" data-id="${p.id}">Like</button>
        <span class="like-count" id="like-count-post-${p.id}">${likeCount} like${likeCount === 1 ? "" : "s"}</span>
      </div>
      <div class="comments" id="comments-post-${p.id}">
        <div class="inline-meta" style="margin-top:6px;">Comments</div>
        ${comments.map(c => `
          <div class="comment">
            <strong>${c.profiles?.username || "User"}</strong>:
            ${escapeHtml(c.content)}
            <div class="inline-meta">${new Date(c.created_at).toLocaleString()}</div>
          </div>
        `).join("")}
      </div>
      ${user ? `
        <form class="comment-form" data-type="post" data-id="${p.id}" style="margin-top:6px;">
          <div class="form-group">
            <input type="text" name="comment" placeholder="Write a comment…" required>
          </div>
        </form>
      ` : ""}
    `;
    feedEl.appendChild(card);
  }

  attachLikeHandlers();
  attachCommentHandlers();
}

// ==============================
// Page: Stories list
// ==============================
async function renderStoryList() {
  const user = await getCurrentUser();

  app.innerHTML = `
    <h2>Stories</h2>
    ${user ? `
      <div class="card">
        <h3>Publish a story</h3>
        <form id="story-form">
          <div class="form-group">
            <label>Title</label>
            <input name="title" required>
          </div>
          <div class="form-group">
            <label>Tags (comma-separated)</label>
            <input name="tags">
          </div>
          <div class="form-group">
            <label>Content</label>
            <textarea name="content" required></textarea>
          </div>
          <button class="btn" type="submit">Publish</button>
        </form>
      </div>
    ` : `
      <div class="card">
        <p><a href="/login" data-link>Log in</a> to publish stories.</p>
      </div>
    `}
    <div class="search-bar">
      <input id="story-search" placeholder="Search stories by title or tag…">
      <button class="btn-outline btn-sm" id="story-search-btn">Search</button>
    </div>
    <div id="story-list"></div>
  `;

  if (user) {
    document.getElementById("story-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = e.target.title.value.trim();
      const content = e.target.content.value.trim();
      const tagsRaw = e.target.tags.value.trim();
      const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

      const { data: story, error } = await supabase
        .from("stories")
        .insert({
          author_id: user.id,
          title,
          content,
        })
        .select()
        .single();

      if (error) {
        alert("Error publishing story: " + error.message);
        return;
      }

      // Upsert tags and link
      for (const tagName of tags) {
        const { data: tag } = await supabase
          .from("tags")
          .upsert({ name: tagName.toLowerCase() }, { onConflict: "name" })
          .select()
          .single();

        await supabase.from("story_tags").insert({
          story_id: story.id,
          tag_id: tag.id,
        });
      }

      e.target.reset();
      renderStoryList();
    });
  }

  async function loadStories(query) {
    let storiesQuery = supabase
      .from("stories")
      .select("id, title, created_at, author_id, profiles(username), story_tags(tags(name))")
      .order("created_at", { ascending: false });

    if (query) {
      // Simple title search; tag search handled client-side
      storiesQuery = storiesQuery.ilike("title", `%${query}%`);
    }

    const { data: stories, error } = await storiesQuery;
    if (error) {
      document.getElementById("story-list").innerHTML = `<p>Error loading stories.</p>`;
      return;
    }

    const listEl = document.getElementById("story-list");
    listEl.innerHTML = "";

    for (const s of stories) {
      const tags = (s.story_tags || []).map(st => st.tags?.name).filter(Boolean);
      const likeCount = await getLikeCount("story", s.id);

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-header">
          <div>
            <div class="card-title">
              <a href="/story/${s.id}" data-link>${escapeHtml(s.title)}</a>
            </div>
            <div class="card-meta">
              by <a href="/profile/${s.author_id}" data-link>${s.profiles?.username || "Unknown"}</a> ·
              ${new Date(s.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        ${tags.length ? `
          <div class="tag-list">
            ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
          </div>
        ` : ""}
        <div style="margin-top:8px;">
          <button class="btn-outline btn-sm like-btn" data-type="story" data-id="${s.id}">Like</button>
          <span class="like-count" id="like-count-story-${s.id}">${likeCount} like${likeCount === 1 ? "" : "s"}</span>
        </div>
      `;
      listEl.appendChild(card);
    }

    attachLikeHandlers();
  }

  document.getElementById("story-search-btn").addEventListener("click", () => {
    const q = document.getElementById("story-search").value.trim();
    loadStories(q);
  });

  loadStories();
}

// ==============================
// Page: Single Story
// ==============================
async function renderStory(id) {
  const user = await getCurrentUser();

  const { data: story, error } = await supabase
    .from("stories")
    .select("id, title, content, created_at, author_id, profiles(username), story_tags(tags(name))")
    .eq("id", id)
    .single();

  if (error || !story) {
    app.innerHTML = `<h2>Story not found</h2>`;
    return;
  }

  const tags = (story.story_tags || []).map(st => st.tags?.name).filter(Boolean);
  const likeCount = await getLikeCount("story", story.id);
  const comments = await getComments("story", story.id);

  app.innerHTML = `
    <h2>${escapeHtml(story.title)}</h2>
    <div class="card">
      <div class="card-meta">
        by <a href="/profile/${story.author_id}" data-link>${story.profiles?.username || "Unknown"}</a> ·
        ${new Date(story.created_at).toLocaleString()}
      </div>
      ${tags.length ? `
        <div class="tag-list" style="margin-top:6px;">
          ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
        </div>
      ` : ""}
      <div style="margin-top:10px;">
        ${escapeHtml(story.content).replace(/\n/g, "<br>")}
      </div>
      <div style="margin-top:10px;">
        <button class="btn-outline btn-sm like-btn" data-type="story" data-id="${story.id}">Like</button>
        <span class="like-count" id="like-count-story-${story.id}">${likeCount} like${likeCount === 1 ? "" : "s"}</span>
      </div>
    </div>

    <div class="card">
      <h3>Comments</h3>
      <div id="comments-story-${story.id}">
        ${comments.map(c => `
          <div class="comment">
            <strong>${c.profiles?.username || "User"}</strong>:
            ${escapeHtml(c.content)}
            <div class="inline-meta">${new Date(c.created_at).toLocaleString()}</div>
          </div>
        `).join("")}
      </div>
      ${user ? `
        <form class="comment-form" data-type="story" data-id="${story.id}" style="margin-top:6px;">
          <div class="form-group">
            <input type="text" name="comment" placeholder="Write a comment…" required>
          </div>
        </form>
      ` : `<p class="inline-meta">Log in to comment.</p>`}
    </div>
  `;

  attachLikeHandlers();
  attachCommentHandlers();
}

// ==============================
// Page: Collections list
// ==============================
async function renderCollectionList() {
  const user = await getCurrentUser();

  app.innerHTML = `
    <h2>Collections</h2>
    ${user ? `
      <div class="card">
        <h3>Create a collection</h3>
        <form id="collection-form">
          <div class="form-group">
            <label>Name</label>
            <input name="name" required>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description"></textarea>
          </div>
          <button class="btn" type="submit">Create</button>
        </form>
      </div>
    ` : `
      <div class="card">
        <p><a href="/login" data-link>Log in</a> to create collections.</p>
      </div>
    `}
    <div id="collection-list"></div>
  `;

  if (user) {
    document.getElementById("collection-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = e.target.name.value.trim();
      const description = e.target.description.value.trim();

      const { error } = await supabase.from("collections").insert({
        owner_id: user.id,
        name,
        description,
      });
      if (error) {
        alert("Error creating collection: " + error.message);
        return;
      }
      e.target.reset();
      renderCollectionList();
    });
  }

  const { data: collections, error } = await supabase
    .from("collections")
    .select("id, name, description, created_at, owner_id, profiles(username)")
    .order("created_at", { ascending: false });

  if (error) {
    document.getElementById("collection-list").innerHTML = `<p>Error loading collections.</p>`;
    return;
  }

  const listEl = document.getElementById("collection-list");
  listEl.innerHTML = "";

  for (const c of collections) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">
            <a href="/collection/${c.id}" data-link>${escapeHtml(c.name)}</a>
          </div>
          <div class="card-meta">
            by <a href="/profile/${c.owner_id}" data-link>${c.profiles?.username || "Unknown"}</a> ·
            ${new Date(c.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div>${escapeHtml(c.description || "")}</div>
    `;
    listEl.appendChild(card);
  }
}

// ==============================
// Page: Single Collection
// ==============================
async function renderCollection(id) {
  const user = await getCurrentUser();

  const { data: collection, error } = await supabase
    .from("collections")
    .select("id, name, description, created_at, owner_id, profiles(username)")
    .eq("id", id)
    .single();

  if (error || !collection) {
    app.innerHTML = `<h2>Collection not found</h2>`;
    return;
  }

  const { data: items } = await supabase
    .from("collection_items")
    .select("id, story_id, stories(title)")
    .eq("collection_id", id);

  app.innerHTML = `
    <h2>${escapeHtml(collection.name)}</h2>
    <div class="card">
      <div class="card-meta">
        by <a href="/profile/${collection.owner_id}" data-link>${collection.profiles?.username || "Unknown"}</a> ·
        ${new Date(collection.created_at).toLocaleString()}
      </div>
      <p style="margin-top:8px;">${escapeHtml(collection.description || "")}</p>
    </div>

    <div class="card">
      <h3>Stories in this collection</h3>
      ${items && items.length ? `
        <ul>
          ${items.map(i => `
            <li><a href="/story/${i.story_id}" data-link>${escapeHtml(i.stories?.title || "Untitled")}</a></li>
          `).join("")}
        </ul>
      ` : `<p>No stories yet.</p>`}
    </div>

    ${user && user.id === collection.owner_id ? `
      <div class="card">
        <h3>Add a story to this collection</h3>
        <form id="add-story-to-collection">
          <div class="form-group">
            <label>Story ID</label>
            <input name="story_id" required>
          </div>
          <button class="btn" type="submit">Add</button>
        </form>
        <p class="inline-meta">Later you can replace this with a search/selector UI.</p>
      </div>
    ` : ""}
  `;

  if (user && user.id === collection.owner_id) {
    document
      .getElementById("add-story-to-collection")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const storyId = e.target.story_id.value.trim();
        if (!storyId) return;
        const { error } = await supabase.from("collection_items").insert({
          collection_id: collection.id,
          story_id: storyId,
        });
        if (error) {
          alert("Error adding story: " + error.message);
          return;
        }
        renderCollection(id);
      });
  }
}

// ==============================
// Page: Explore (search across stories + posts)
// ==============================
async function renderExplore() {
  app.innerHTML = `
    <h2>Explore</h2>
    <div class="search-bar">
      <input id="explore-query" placeholder="Search stories and posts…">
      <button class="btn-outline btn-sm" id="explore-btn">Search</button>
    </div>
    <div id="explore-results"></div>
  `;

  document.getElementById("explore-btn").addEventListener("click", async () => {
    const q = document.getElementById("explore-query").value.trim();
    const resultsEl = document.getElementById("explore-results");
    resultsEl.innerHTML = "";

    if (!q) {
      resultsEl.innerHTML = `<p>Type something to search.</p>`;
      return;
    }

    const { data: stories } = await supabase
      .from("stories")
      .select("id, title, created_at, author_id, profiles(username)")
      .ilike("title", `%${q}%`);

    const { data: posts } = await supabase
      .from("posts")
      .select("id, content, created_at, author_id, profiles(username)")
      .ilike("content", `%${q}%`);

    resultsEl.innerHTML += `<h3>Stories</h3>`;
    if (stories && stories.length) {
      for (const s of stories) {
        resultsEl.innerHTML += `
          <div class="card">
            <div class="card-title">
              <a href="/story/${s.id}" data-link>${escapeHtml(s.title)}</a>
            </div>
            <div class="card-meta">
              by <a href="/profile/${s.author_id}" data-link>${s.profiles?.username || "Unknown"}</a> ·
              ${new Date(s.created_at).toLocaleDateString()}
            </div>
          </div>
        `;
      }
    } else {
      resultsEl.innerHTML += `<p>No stories found.</p>`;
    }

    resultsEl.innerHTML += `<h3>Posts</h3>`;
    if (posts && posts.length) {
      for (const p of posts) {
        resultsEl.innerHTML += `
          <div class="card">
            <div class="card-meta">
              by <a href="/profile/${p.author_id}" data-link>${p.profiles?.username || "Unknown"}</a> ·
              ${new Date(p.created_at).toLocaleDateString()}
            </div>
            <div>${escapeHtml(p.content).replace(/\n/g, "<br>")}</div>
          </div>
        `;
      }
    } else {
      resultsEl.innerHTML += `<p>No posts found.</p>`;
    }
  });
}

// ==============================
// Page: Profile (current user)
// ==============================
async function renderMyProfile() {
  const user = await getCurrentUser();
  if (!user) {
    navigate("/login");
    return;
  }
  return renderProfile(user.id, true);
}

// ==============================
// Page: Profile (by id)
// ==============================
async function renderProfile(id, isSelf = false) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !profile) {
    app.innerHTML = `<h2>Profile not found</h2>`;
    return;
  }

  const { data: stories } = await supabase
    .from("stories")
    .select("id, title, created_at")
    .eq("author_id", id)
    .order("created_at", { ascending: false });

  const { data: posts } = await supabase
    .from("posts")
    .select("id, content, created_at")
    .eq("author_id", id)
    .order("created_at", { ascending: false });

  app.innerHTML = `
    <h2>${escapeHtml(profile.username || profile.email || "User")}</h2>
    <div class="card">
      <p>${escapeHtml(profile.bio || "")}</p>
      <div class="inline-meta">Joined: ${profile.created_at ? new Date(profile.created_at).toLocaleDateString() : ""}</div>
      ${isSelf ? `
        <hr>
        <h3>Edit profile</h3>
        <form id="profile-form">
          <div class="form-group">
            <label>Username</label>
            <input name="username" value="${escapeHtml(profile.username || "")}">
          </div>
          <div class="form-group">
            <label>Bio</label>
            <textarea name="bio">${escapeHtml(profile.bio || "")}</textarea>
          </div>
          <button class="btn" type="submit">Save</button>
        </form>
      ` : ""}
    </div>

    <h3>Stories</h3>
    ${stories && stories.length ? stories.map(s => `
      <div class="card">
        <div class="card-title">
          <a href="/story/${s.id}" data-link>${escapeHtml(s.title)}</a>
        </div>
        <div class="card-meta">${new Date(s.created_at).toLocaleDateString()}</div>
      </div>
    `).join("") : `<p>No stories yet.</p>`}

    <h3>Posts</h3>
    ${posts && posts.length ? posts.map(p => `
      <div class="card">
        <div class="card-meta">${new Date(p.created_at).toLocaleDateString()}</div>
        <div>${escapeHtml(p.content).replace(/\n/g, "<br>")}</div>
      </div>
    `).join("") : `<p>No posts yet.</p>`}
  `;

  if (isSelf) {
    document.getElementById("profile-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = e.target.username.value.trim();
      const bio = e.target.bio.value.trim();
      const { error } = await supabase
        .from("profiles")
        .update({ username, bio })
        .eq("id", id);
      if (error) {
        alert("Error updating profile: " + error.message);
        return;
      }
      renderProfile(id, true);
    });
  }
}

// ==============================
// Likes + Comments helpers
// ==============================
async function getLikeCount(targetType, targetId) {
  const { count } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  return count || 0;
}

async function getComments(targetType, targetId) {
  const { data } = await supabase
    .from("comments")
    .select("id, content, created_at, author_id, profiles(username)")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true });
  return data || [];
}

function attachLikeHandlers() {
  document.querySelectorAll(".like-btn").forEach((btn) => {
    btn.onclick = async () => {
      const targetType = btn.getAttribute("data-type");
      const targetId = btn.getAttribute("data-id");
      const user = await getCurrentUser();
      if (!user) {
        navigate("/login");
        return;
      }
      // toggle like
      const { data: existing } = await supabase
        .from("likes")
        .select("id")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("likes").delete().eq("id", existing.id);
      } else {
        await supabase.from("likes").insert({
          target_type: targetType,
          target_id: targetId,
          user_id: user.id,
        });
      }

      const count = await getLikeCount(targetType, targetId);
      const countEl = document.getElementById(`like-count-${targetType}-${targetId}`);
      if (countEl) {
        countEl.textContent = `${count} like${count === 1 ? "" : "s"}`;
      }
    };
  });
}

function attachCommentHandlers() {
  document.querySelectorAll(".comment-form").forEach((form) => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const user = await getCurrentUser();
      if (!user) {
        navigate("/login");
        return;
      }
      const targetType = form.getAttribute("data-type");
      const targetId = form.getAttribute("data-id");
      const content = form.comment.value.trim();
      if (!content) return;

      const { error } = await supabase.from("comments").insert({
        target_type: targetType,
        target_id: targetId,
        author_id: user.id,
        content,
      });
      if (error) {
        alert("Error posting comment: " + error.message);
        return;
      }

      form.reset();

      // Reload comments for that target
      const comments = await getComments(targetType, targetId);
      const container = document.getElementById(`comments-${targetType}-${targetId}`);
      if (container) {
        container.innerHTML = comments.map(c => `
          <div class="comment">
            <strong>${c.profiles?.username || "User"}</strong>:
            ${escapeHtml(c.content)}
            <div class="inline-meta">${new Date(c.created_at).toLocaleString()}</div>
          </div>
        `).join("");
      }
    };
  });
}

// ==============================
// Utility
// ==============================
function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ==============================
// Start
// ==============================
router();