import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import fs from 'fs';
import qr from 'qr-image';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import bmiRoutes from './routes/bmiRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
const PORT = 3000;

const userDB = mongoose.createConnection("mongodb://127.0.0.1:27017/userDB");

const blogDB = mongoose.createConnection("mongodb://127.0.0.1:27017/blogsDB");

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});
const User = userDB.model("User", userSchema);

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  author: { type: String, default: "Anonymous" },
  createdAt: { type: Date, default: Date.now }
});
const Blog = blogDB.model("Blog", blogSchema);

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: "mysecret",
    resave: false,
    saveUninitialized: true,
  })
);

const __dirname = path.resolve();

const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect("/");
};

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.post("/register", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const newUser = new User({ username: req.body.username, password: hashedPassword });
    await newUser.save();
    res.redirect("/");
  } catch (err) {
    res.status(500).send("Error registering new user. Try again.");
  }
});

app.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (user && (await bcrypt.compare(req.body.password, user.password))) {
      req.session.user = user;
      res.sendFile(path.join(__dirname, "public", "dashboard.html"));
    } else {
      res.send("Invalid username or password.");
    }
  } catch (err) {
    res.status(500).send("Error logging in.");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
  });
});

app.get("/dashboard", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get('/generate-qr', (req, res) => {
  const { url } = req.query;
  if (!url) {
      return res.status(400).send("URL is required");
  }

  const qrCodeImage = qr.image(url, { type: 'png' });
  const filePath = path.join(__dirname, 'public', 'qrcode.png');

  const writeStream = fs.createWriteStream(filePath);
  qrCodeImage.pipe(writeStream);

  writeStream.on('finish', () => {
      res.status(200).sendFile(filePath);
  });

  writeStream.on('error', (err) => {
      res.status(500).send("Error generating QR code");
  });
});

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: '231502@astanait.edu.kz',
    pass: '', 
  },
});

app.get('/send-email', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'send-email.html'));
});


app.post('/send-email', async (req, res) => {
  const { to, subject, message } = req.body;

  console.log("Received request body:", req.body); 

  if (!to || !subject || !message) {
    return res.status(400).send("All fields are required.");
  }

  try {
    await transporter.sendMail({
      from: '231502@astanait.edu.kz',
      to,
      subject,
      text: message,
    });
    res.send("Email sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).send("Error sending email.");
  }
});

app.use('/bmi', bmiRoutes);

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY; 
const REST_COUNTRIES_API = "https://restcountries.com/v3.1";
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

app.get("/api/weather", async (req, res) => {
    const city = req.query.city;
    if (!city) {
        return res.status(400).json({ error: "City name is required" });
    }

    try {
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHER_API_KEY}&units=metric`;
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();

        if (weatherData.cod !== 200) {
            return res.status(404).json({ error: weatherData.message || "City not found" });
        }

        const { coord, main, weather, wind, sys, rain } = weatherData;
        const countryCode = sys?.country;

        let countryFlag = "";
        let countryName = "Unknown";
        let fetchedCountryCode = countryCode;
        let currencyCode = "";
        let currencyName = "";
        let currencySymbol = "";

        if (countryCode) {
            const countryUrl = `${REST_COUNTRIES_API}/alpha/${countryCode}`;
            const countryResponse = await fetch(countryUrl);
            const countryData = await countryResponse.json();

            if (Array.isArray(countryData) && countryData.length > 0) {
                const countryInfo = countryData[0];
                countryFlag = countryInfo?.flags?.png || "";
                countryName = countryInfo?.name?.common || "Unknown";
                fetchedCountryCode = countryInfo?.cca2 || countryCode;

                const currencies = countryInfo?.currencies;
                if (currencies) {
                    const currencyKey = Object.keys(currencies)[0]; 
                    if (currencyKey) {
                        currencyCode = currencyKey;
                        currencyName = currencies[currencyKey]?.name || "";
                        currencySymbol = currencies[currencyKey]?.symbol || "";
                    }
                }
            }
        }

        let placePhoto = "";
        let placeName = "No famous place found";

        if (PEXELS_API_KEY) {
            const pexelsUrl = `https://api.pexels.com/v1/search?query=${countryName}+landmark&per_page=1`;
            const pexelsResponse = await fetch(pexelsUrl, {
                headers: { Authorization: PEXELS_API_KEY },
            });
            const pexelsData = await pexelsResponse.json();

            if (pexelsData.photos && pexelsData.photos.length > 0) {
                placePhoto = pexelsData.photos[0].src.medium;
                placeName = pexelsData.photos[0].alt;
            }
        }

        const airQualityUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${coord.lat}&lon=${coord.lon}&appid=${OPENWEATHER_API_KEY}`;
        const airQualityResponse = await fetch(airQualityUrl);
        const airQualityData = await airQualityResponse.json();

        let airQuality = "Unknown";
        if (airQualityData.list && airQualityData.list.length > 0) {
            const aqi = airQualityData.list[0].main.aqi;
            airQuality = ["Good", "Fair", "Moderate", "Poor", "Very Poor"][aqi - 1] || "Unknown";
        }

        res.json({
            city: city,
            countryCode: fetchedCountryCode,
            lat: coord.lat,
            lon: coord.lon,
            temp: main.temp,
            feels_like: main.feels_like,
            humidity: main.humidity,
            pressure: main.pressure,
            windSpeed: wind.speed,
            description: weather[0].description,
            icon: weather[0].icon,
            rainVolume: rain ? rain["3h"] || 0 : 0,
            countryFlag: countryFlag,
            countryName: countryName,
            currency: {
                code: currencyCode,
                name: currencyName,
                symbol: currencySymbol,
            },
            placePhoto: placePhoto,
            placeName: placeName,
            airQuality: airQuality
        });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ error: "Failed to fetch data" });
    }
});


app.post("/blogs", async (req, res) => {
  try {
    const newBlog = new Blog(req.body);
    await newBlog.save();
    res.status(201).json(newBlog);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find();
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch blogs" });
  }
});

app.get("/blogs/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    res.json(blog);
  } catch (error) {
    res.status(500).json({ error: "Invalid blog ID" });
  }
});

app.put("/blogs/:id", async (req, res) => {
  try {
    const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedBlog) return res.status(404).json({ error: "Blog not found" });
    res.json(updatedBlog);
  } catch (error) {
    res.status(500).json({ error: "Failed to update blog" });
  }
});

app.delete("/blogs/:id", async (req, res) => {
  try {
    const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
    if (!deletedBlog) return res.status(404).json({ error: "Blog not found" });
    res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete blog" });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
