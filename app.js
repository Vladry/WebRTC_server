const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
// const logger = require('morgan');
const sassMiddleware = require('sass-middleware');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

//app.use(logger('dev'));  // 'dev' формат для удобного чтения в терминале
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
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

/*// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});*/

module.exports = app;
