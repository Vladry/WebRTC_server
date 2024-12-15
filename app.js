import createError from 'http-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
// import logger from 'morgan'; // если нужно
import sassMiddleware from 'sass-middleware';
import session from 'express-session';
import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({path: "./secrets/.env"});

import MemoryStore from 'memorystore';
const MemoryStoreInstance = MemoryStore(session);

const app = express();



// view engine setup
app.set('views', './views');
app.set('view engine', 'pug');

//app.use(logger('dev'));  // 'dev' формат для удобного чтения в терминале
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const sessionStoreInst = new MemoryStoreInstance({
  checkPeriod: 86400000, // Удаление устаревших сессий каждые 24 часа
});
const sessionMiddleware = session({
  secret: process.env.SECRET_KEY_COOKIE,
  resave: false,
  saveUninitialized: true,
  store: sessionStoreInst,
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
  src: path.join('/scss'), // Папка с исходными файлами .scss
  dest: path.join('/public/stylesheets'), // Папка, куда будут выводиться скомпилированные .css файлы
  indentedSyntax: false, // true = .sass and false = .scss
  sourceMap: true,
  debug: true, // Включаем дебаг для просмотра ошибок компиляции
  outputStyle: 'compressed', // Сжимаем выходной CSS
  prefix: '',  // Префикс для скомпилированных CSS
}));
// Статические файлы
app.use(express.static(path.join('public')));

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


export {app, sessionStoreInst};
