import express from 'express';
const router = express.Router();
import Blog from '../models/Blog.js';

router.post('/blogs', async (req, res) => {
    try {
        const { title, author, body } = req.body;
        const newBlog = new Blog({ title, author, body });
        await newBlog.save();
        res.status(201).json(newBlog);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/blogs', async (req, res) => {
    try {
        const blogs = await Blog.find();
        res.json(blogs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/blogs/:id', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ message: 'Blog not found' });
        res.json(blog);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.put('/blogs/:id', async (req, res) => {
    try {
        const { title, author, body } = req.body;
        const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, { title, author, body }, { new: true });
        if (!updatedBlog) return res.status(404).json({ message: 'Blog not found' });
        res.json(updatedBlog);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.delete('/blogs/:id', async (req, res) => {
    try {
        const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
        if (!deletedBlog) return res.status(404).json({ message: 'Blog not found' });
        res.json({ message: 'Blog deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
