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
import bmiRoutes from './routes/bmiRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import cors from 'cors';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
const PORT = 3000;

mongoose.connect("mongodb://127.0.0.1:27017/userDB");

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});
const User = mongoose.model("User", userSchema);

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
    pass: 'cx7ypj3pDlVYr', 
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
            return res.status(404).json({ error: "City not found" });
        }

        const { coord, main, weather, wind, sys, rain } = weatherData;

        const countryUrl = `${REST_COUNTRIES_API}/alpha/${sys.country}`;
        const countryResponse = await fetch(countryUrl);
        const countryData = await countryResponse.json();
        const countryFlag = countryData[0]?.flags?.png || "";
        const countryName = countryData[0]?.name?.common || "Unknown";
        const fetchedCountryCode = countryInfo.cca2 || countryCode;

        const pexelsUrl = `https://api.pexels.com/v1/search?query=${countryName}+landmark&per_page=1`;
        const pexelsResponse = await fetch(pexelsUrl, {
            headers: { Authorization: PEXELS_API_KEY },
        });
        const pexelsData = await pexelsResponse.json();
        const placePhoto = pexelsData.photos.length > 0 ? pexelsData.photos[0].src.medium : "";
        const placeName = pexelsData.photos.length > 0 ? pexelsData.photos[0].alt : "No famous place found";

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
            placePhoto: placePhoto,
            placeName: placeName
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch data" });
    }
});

app.use("/api", blogRoutes);

mongoose.connect("mongodb://127.0.0.1:27017/blogs")
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log("MongoDB connection error:", err));



    const express = require('express');
    const mongoose = require('mongoose');
    const cors = require('cors');
    const path = require('path');
    
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    
    
    const blogRoutes = require("./routes/blogRoutes");
    app.use("/api", blogRoutes);
    
    mongoose.connect("mongodb://127.0.0.1:27017/blogs")
        .then(() => console.log("MongoDB Connected"))
        .catch(err => console.log("MongoDB connection error:", err));
    
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
