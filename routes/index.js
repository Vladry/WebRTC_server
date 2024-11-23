const express = require('express');
const router = express.Router();
require('dotenv').config();
const port = process.env.PORT || '3000';
const MaxObj = {
    title: 'Макс!',
    msg: 'И ты тоже сможешь БПЛА поуправлять отсюда',
    imagePath: '/images/Max.jpg'};
const NikObj = {
    title: 'Николай!',
    msg: 'Тут ты можешь управлять нашим БПЛА по интернету!',
    imagePath: '/images/Nik.jpg'
}
const LeshaObj = {
    title: 'Лёша!',
    msg: 'Как тебе страница, чтоб управлять БПЛА по интернету?',
    imagePath: '/images/Lesha.jpg'
}
const VladObj = {
    title: 'Влад!',
    msg: 'А ты вообще родился смотреть видео с БПЛА по Старлинку',
    imagePath: '/images/Vlad.jpg'
}
const title = 'Коллеги Влада !!!';
const msg = 'доверься и перейди по ссылкам ниже:'

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {title: title, msg: msg});
});

router.get('/ip', (req, res) => {
    res.render('index', {title: req.ip});
});

router.get('/Nik', (req, res) => {
    res.render('dashboard', NikObj);
});

router.get('/Max', (req, res) => {
    res.render('dashboard', MaxObj);
});

router.get('/Lesha', (req, res) => {
    res.render('dashboard', LeshaObj);
});

router.get('/Vlad', (req, res) => {
    res.render('dashboard', VladObj);
});
module.exports = router;
