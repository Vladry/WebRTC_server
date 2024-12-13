const createError = require('http-errors');
const express = require('express');
const path = require('path');

const cookieParser = require('cookie-parser');
// const logger = require('morgan');
const sassMiddleware = require('sass-middleware');
const session = require('express-session');
const indexRouter = require('./routes/index');

const usersRouter = require('./routes/users');
const locations = require("./locations.json");
require('dotenv').config({path: `${locations.env}`});
const MemoryStore = require('memorystore')(session);

const app = express();



// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

//app.use(logger('dev'));  // 'dev' формат для удобного чтения в терминале
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const sessionStore = new MemoryStore({
  checkPeriod: 86400000, // Удаление устаревших сессий каждые 24 часа
});
const sessionMiddleware = session({
  secret: process.env.SECRET_KEY_COOKIE,
  resave: false,
  saveUninitialized: true,
  store: sessionStore,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 дней
    // secure: false, // Не использовать HTTPS для куки, т.к. на сервере нет SSL-сертификата
    secure: true, // для HTTPS для куки на сервере с сертификатом
  }
});

app.use(cookieParser());
app.use(sessionMiddleware);
// Подключаем sass-middleware
app.use(sassMiddleware({
  src: path.join(__dirname, '/scss'), // Папка с исходными файлами .scss
  dest: path.join(__dirname, '/public/stylesheets'), // Папка, куда будут выводиться скомпилированные .css файлы
  indentedSyntax: false, // true = .sass and false = .scss
  sourceMap: true,
  debug: true, // Включаем дебаг для просмотра ошибок компиляции
  outputStyle: 'compressed', // Сжимаем выходной CSS
  prefix: '',  // Префикс для скомпилированных CSS
}));
// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

app.get('/', (req, res) => {
  if (!req.session.clientId) {
    req.session.clientId = `client-${Date.now()}`;
  }
  console.log(`HTTPS Client ID: ${req.session.clientId}`);
  res.send('<h1>Connected via HTTPS</h1>');
});


module.exports = { app, sessionStore };
