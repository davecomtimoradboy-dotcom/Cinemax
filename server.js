require("dotenv").config();

const path=require("path");
const express=require("express");
const cors=require("cors");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const Database=require("better-sqlite3");
const helmet=require("helmet");
const rateLimit=require("express-rate-limit");

const app=express();
const PORT=Number(process.env.PORT)||3000;
const SECRET=process.env.JWT_SECRET||"change-this-secret";

if(SECRET==="change-this-secret"){
  console.warn("WARNING: Set JWT_SECRET in .env before production.");
}

app.use(helmet({contentSecurityPolicy:false}));
app.use(rateLimit({windowMs:15*60*1000,max:300,standardHeaders:true,legacyHeaders:false}));
app.use(cors());
app.use(express.json({limit:"1mb"}));
app.use(express.static(__dirname));

const db=new Database("cinemax.db");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user',
 avatar TEXT DEFAULT '',
 bio TEXT DEFAULT '',
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS favorites(
 user_id INTEGER NOT NULL,
 movie_id INTEGER NOT NULL,
 PRIMARY KEY(user_id,movie_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(movie_id) REFERENCES movies(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS movies(
 id INTEGER PRIMARY KEY,
 title TEXT NOT NULL,
 year INTEGER NOT NULL,
 genre TEXT NOT NULL,
 rating REAL NOT NULL DEFAULT 0,
 poster TEXT NOT NULL,
 backdrop TEXT NOT NULL,
 description TEXT NOT NULL,
 video_url TEXT DEFAULT '',
 featured INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS progress(
 user_id INTEGER NOT NULL,
 movie_id INTEGER NOT NULL,
 seconds REAL DEFAULT 0,
 duration REAL DEFAULT 0,
 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,movie_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(movie_id) REFERENCES movies(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS reviews(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 movie_id INTEGER NOT NULL,
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 text TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,movie_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(movie_id) REFERENCES movies(id) ON DELETE CASCADE
);
`);

const seed=[
["Avengers: Endgame",2019,"Action",9,"https://images.unsplash.com/photo-1531259683007-016a7b628fc3?auto=format&fit=crop&w=700&q=80","https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80","The Avengers unite for their final battle to restore what was lost."],
["Spider-Man",2021,"Action",8.7,"https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&w=700&q=80","https://images.unsplash.com/photo-1534801022020-3c9c5c0a0c0d?auto=format&fit=crop&w=1600&q=80","A young hero learns that great power comes with great responsibility."],
["The Batman",2022,"Drama",8.5,"https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?auto=format&fit=crop&w=700&q=80","https://images.unsplash.com/photo-1519638399535-1b036603ac77?auto=format&fit=crop&w=1600&q=80","Batman investigates a dangerous mystery hidden beneath Gotham City."],
["Interstellar",2014,"Sci-Fi",9.1,"https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=700&q=80","https://images.unsplash.com/photo-1446776877081-d282a0f896e2?auto=format&fit=crop&w=1600&q=80","Explorers travel beyond our solar system in search of a future for humanity."],
["John Wick",2014,"Action",8.4,"https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=700&q=80","https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80","A legendary action thriller about a retired assassin pulled back into danger."],
["Avatar",2009,"Sci-Fi",8.8,"https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=700&q=80","https://images.unsplash.com/photo-1534791547706-9f67f1b2c8c0?auto=format&fit=crop&w=1600&q=80","A marine discovers a new world and becomes caught between two civilizations."]
];

const add=db.prepare("INSERT OR IGNORE INTO movies(title,year,genre,rating,poster,backdrop,description) VALUES(?,?,?,?,?,?,?)");
seed.forEach(m=>add.run(...m));

function auth(req,res,next){
  const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!token)return res.status(401).json({message:"Login required"});
  try{req.user=jwt.verify(token,SECRET);next()}catch(e){return res.status(401).json({message:"Invalid or expired token"})}
}
function admin(req,res,next){
  if(req.user.role!=="admin")return res.status(403).json({message:"Admin access required"});
  next();
}
function validId(value){return Number.isInteger(Number(value))&&Number(value)>0}
function cleanText(value,max=5000){return String(value??"").trim().slice(0,max)}
function movieInput(body){
  const year=Number(body.year),rating=Number(body.rating);
  if(!cleanText(body.title,200)||!Number.isInteger(year)||year<1888||year>2200||!cleanText(body.genre,80)||
     !Number.isFinite(rating)||rating<0||rating>10||!cleanText(body.poster,1000)||!cleanText(body.backdrop,1000)||!cleanText(body.description,5000)){
    return null;
  }
  return {
    title:cleanText(body.title,200),year,genre:cleanText(body.genre,80),rating,
    poster:cleanText(body.poster,1000),backdrop:cleanText(body.backdrop,1000),
    description:cleanText(body.description,5000),video_url:cleanText(body.video_url,2000),
    featured:Boolean(body.featured)
  };
}

app.get("/api/health",(req,res)=>res.json({status:"ok",service:"CineMax API",time:new Date().toISOString()}));

app.get("/api/movies",(req,res)=>{
  let sql="SELECT * FROM movies WHERE 1=1",p={};
  if(req.query.search){sql+=" AND (title LIKE @search OR genre LIKE @search OR description LIKE @search)";p.search="%"+cleanText(req.query.search,100)+"%"}
  if(req.query.genre&&req.query.genre!=="all"){sql+=" AND genre=@genre";p.genre=cleanText(req.query.genre,80)}
  sql+=" ORDER BY featured DESC,rating DESC,year DESC,title ASC";
  res.json(db.prepare(sql).all(p));
});

app.get("/api/movies/:id",(req,res)=>{
  if(!validId(req.params.id))return res.status(400).json({message:"Invalid movie id"});
  const movie=db.prepare("SELECT * FROM movies WHERE id=?").get(Number(req.params.id));
  movie?res.json(movie):res.status(404).json({message:"Movie not found"});
});

app.post("/api/auth/register",async(req,res)=>{
  const name=cleanText(req.body.name,100),email=cleanText(req.body.email,200).toLowerCase(),password=String(req.body.password||"");
  if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||password.length<6)return res.status(400).json({message:"Enter a valid name, email and a password of at least 6 characters"});
  try{
    const r=db.prepare("INSERT INTO users(name,email,password) VALUES(?,?,?)").run(name,email,await bcrypt.hash(password,12));
    const user={id:Number(r.lastInsertRowid),name,email,role:"user",avatar:"",bio:""};
    res.status(201).json({token:jwt.sign(user,SECRET,{expiresIn:"7d"}),user});
  }catch(e){res.status(409).json({message:"Email already registered"})}
});

app.post("/api/auth/login",async(req,res)=>{
  const email=cleanText(req.body.email,200).toLowerCase(),password=String(req.body.password||"");
  const u=db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if(!u||!(await bcrypt.compare(password,u.password)))return res.status(401).json({message:"Invalid email or password"});
  const user={id:u.id,name:u.name,email:u.email,role:u.role,avatar:u.avatar,bio:u.bio};
  res.json({token:jwt.sign(user,SECRET,{expiresIn:"7d"}),user});
});

app.get("/api/me",auth,(req,res)=>res.json(db.prepare("SELECT id,name,email,role,avatar,bio,created_at FROM users WHERE id=?").get(req.user.id)));

app.put("/api/profile",auth,(req,res)=>{
  const name=cleanText(req.body.name,100),avatar=cleanText(req.body.avatar,1000),bio=cleanText(req.body.bio,1000);
  if(name.length<2)return res.status(400).json({message:"Name is required"});
  db.prepare("UPDATE users SET name=?,avatar=?,bio=? WHERE id=?").run(name,avatar,bio,req.user.id);
  const user=db.prepare("SELECT id,name,email,role,avatar,bio FROM users WHERE id=?").get(req.user.id);
  res.json({message:"Profile updated",user});
});

app.get("/api/favorites",auth,(req,res)=>res.json(db.prepare("SELECT movies.* FROM movies JOIN favorites ON movies.id=favorites.movie_id WHERE favorites.user_id=? ORDER BY movies.rating DESC").all(req.user.id)));
app.post("/api/favorites/:id",auth,(req,res)=>{
  if(!validId(req.params.id)||!db.prepare("SELECT id FROM movies WHERE id=?").get(Number(req.params.id)))return res.status(404).json({message:"Movie not found"});
  db.prepare("INSERT OR IGNORE INTO favorites(user_id,movie_id) VALUES(?,?)").run(req.user.id,Number(req.params.id));
  res.json({message:"Added to watchlist"});
});
app.delete("/api/favorites/:id",auth,(req,res)=>{db.prepare("DELETE FROM favorites WHERE user_id=? AND movie_id=?").run(req.user.id,Number(req.params.id));res.json({message:"Removed from watchlist"})});

app.get("/api/progress",auth,(req,res)=>res.json(db.prepare("SELECT movies.*,progress.seconds,progress.duration,progress.updated_at FROM progress JOIN movies ON movies.id=progress.movie_id WHERE progress.user_id=? AND progress.seconds>0 ORDER BY progress.updated_at DESC").all(req.user.id)));
app.get("/api/progress/:id",auth,(req,res)=>{
  if(!validId(req.params.id))return res.status(400).json({message:"Invalid movie id"});
  res.json(db.prepare("SELECT * FROM progress WHERE user_id=? AND movie_id=?").get(req.user.id,Number(req.params.id))||{seconds:0,duration:0});
});
app.post("/api/progress/:id",auth,(req,res)=>{
  const id=Number(req.params.id),seconds=Math.max(0,Number(req.body.seconds)||0),duration=Math.max(0,Number(req.body.duration)||0);
  if(!validId(id)||!db.prepare("SELECT id FROM movies WHERE id=?").get(id))return res.status(404).json({message:"Movie not found"});
  db.prepare("INSERT INTO progress(user_id,movie_id,seconds,duration,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id,movie_id) DO UPDATE SET seconds=excluded.seconds,duration=excluded.duration,updated_at=CURRENT_TIMESTAMP").run(req.user.id,id,Math.min(seconds,duration||seconds),duration);
  res.json({message:"Progress saved"});
});

app.get("/api/movies/:id/reviews",(req,res)=>{
  if(!validId(req.params.id))return res.status(400).json({message:"Invalid movie id"});
  res.json(db.prepare("SELECT reviews.*,users.name,users.avatar FROM reviews JOIN users ON users.id=reviews.user_id WHERE movie_id=? ORDER BY reviews.created_at DESC").all(Number(req.params.id)));
});
app.post("/api/movies/:id/reviews",auth,(req,res)=>{
  const id=Number(req.params.id),rating=Number(req.body.rating),text=cleanText(req.body.text,2000);
  if(!validId(id)||!db.prepare("SELECT id FROM movies WHERE id=?").get(id))return res.status(404).json({message:"Movie not found"});
  if(!Number.isInteger(rating)||rating<1||rating>5||!text)return res.status(400).json({message:"Choose a rating and write a review"});
  db.prepare("INSERT INTO reviews(user_id,movie_id,rating,text) VALUES(?,?,?,?) ON CONFLICT(user_id,movie_id) DO UPDATE SET rating=excluded.rating,text=excluded.text,created_at=CURRENT_TIMESTAMP").run(req.user.id,id,rating,text);
  res.json({message:"Review saved"});
});

app.get("/api/recommendations",auth,(req,res)=>{
  const rows=db.prepare("SELECT m.* FROM movies m WHERE m.genre IN (SELECT genre FROM movies WHERE id IN (SELECT movie_id FROM favorites WHERE user_id=?)) AND m.id NOT IN (SELECT movie_id FROM favorites WHERE user_id=?) ORDER BY m.rating DESC LIMIT 12").all(req.user.id,req.user.id);
  if(rows.length)return res.json(rows);
  res.json(db.prepare("SELECT * FROM movies WHERE id NOT IN (SELECT movie_id FROM favorites WHERE user_id=?) ORDER BY featured DESC,rating DESC LIMIT 12").all(req.user.id));
});

app.get("/api/admin/stats",auth,admin,(req,res)=>res.json({
  users:db.prepare("SELECT COUNT(*) c FROM users").get().c,
  movies:db.prepare("SELECT COUNT(*) c FROM movies").get().c,
  watchlist:db.prepare("SELECT COUNT(*) c FROM favorites").get().c,
  reviews:db.prepare("SELECT COUNT(*) c FROM reviews").get().c
}));
app.get("/api/admin/users",auth,admin,(req,res)=>res.json(db.prepare("SELECT id,name,email,role,created_at FROM users ORDER BY id DESC").all()));
app.patch("/api/admin/users/:id/role",auth,admin,(req,res)=>{
  const role=req.body.role==="admin"?"admin":"user",id=Number(req.params.id);
  if(!validId(id)||!db.prepare("SELECT id FROM users WHERE id=?").get(id))return res.status(404).json({message:"User not found"});
  if(id===req.user.id&&role!=="admin")return res.status(400).json({message:"You cannot remove your own admin role"});
  db.prepare("UPDATE users SET role=? WHERE id=?").run(role,id);
  res.json({message:"User role updated"});
});
app.delete("/api/admin/users/:id",auth,admin,(req,res)=>{
  const id=Number(req.params.id);
  if(id===req.user.id)return res.status(400).json({message:"You cannot delete your own account here"});
  const result=db.prepare("DELETE FROM users WHERE id=?").run(id);
  result.changes?res.json({message:"User deleted"}):res.status(404).json({message:"User not found"});
});
app.post("/api/admin/movies",auth,admin,(req,res)=>{
  const m=movieInput(req.body);if(!m)return res.status(400).json({message:"Please provide valid movie details"});
  const r=db.prepare("INSERT INTO movies(title,year,genre,rating,poster,backdrop,description,video_url,featured) VALUES(?,?,?,?,?,?,?,?,?)").run(m.title,m.year,m.genre,m.rating,m.poster,m.backdrop,m.description,m.video_url,m.featured?1:0);
  res.status(201).json({id:Number(r.lastInsertRowid)});
});
app.put("/api/admin/movies/:id",auth,admin,(req,res)=>{
  const id=Number(req.params.id),m=movieInput(req.body);
  if(!validId(id)||!m)return res.status(400).json({message:"Invalid movie data"});
  const result=db.prepare("UPDATE movies SET title=?,year=?,genre=?,rating=?,poster=?,backdrop=?,description=?,video_url=?,featured=? WHERE id=?").run(m.title,m.year,m.genre,m.rating,m.poster,m.backdrop,m.description,m.video_url,m.featured?1:0,id);
  result.changes?res.json({message:"Movie updated"}):res.status(404).json({message:"Movie not found"});
});
app.delete("/api/admin/movies/:id",auth,admin,(req,res)=>{
  const result=db.prepare("DELETE FROM movies WHERE id=?").run(Number(req.params.id));
  result.changes?res.json({message:"Movie deleted"}):res.status(404).json({message:"Movie not found"});
});

app.use((req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.listen(PORT,()=>console.log("CineMax running on http://localhost:"+PORT));
