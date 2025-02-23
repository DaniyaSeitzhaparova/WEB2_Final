import express from 'express';

const router = express.Router();

router.post('/calculate-bmi', (req, res) => {
    let { weight, height } = req.body;
    weight = parseFloat(weight);
    height = parseFloat(height);

    if (weight > 0 && height > 0) {
        const bmi = weight / (height * height);
        let category = '';
        let color = '';

        if (bmi < 18.5) { category = 'Underweight'; color = 'blue'; }
        else if (bmi < 24.9) { category = 'Normal weight'; color = 'green'; }
        else if (bmi < 29.9) { category = 'Overweight'; color = 'yellow'; }
        else { category = 'Obese'; color = 'red'; }

        res.json({ bmi, category, color });
    } else {
        res.status(400).json({ error: "Invalid input. Please enter positive numbers." });
    }
});

export default router;
