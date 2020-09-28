"use strict";

const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const io = require("socket.io")();
//Add fs module
const fs = require("fs");
//Add diff module
const diff = require("diff");
//Add EventEmitter class
const {EventEmitter} = require('events');
//
const indexRouter = require("./routes/index");
const app = express();

var old_file = fs.readFileSync('./var/file.txt', {encoding:"utf8"});
var fileEvent = new EventEmitter();



//Diff testing locally
fs.watch('./var/file.txt', function(eventType, filename){
  fs.promises.readFile(`./var/${filename}`,{encoding:"utf8"})
  .then(function(data) {
    //console.log(`The file has this content:\n\n${data}`);
    //console.log(data); This logs the data without string format.
    //To be able to see it as a string representation, add "{encoding: "utf8"}" object before the callback function
    var new_file = data;
    if (new_file !== old_file)
    {
      console.log(`The content of ${filename} has changed. It was a ${eventType} event.`);


      var file_changes = diff.diffLines(old_file, new_file);
      //console.log(`Here are the changes (promise!):`);
      var new_changes = file_changes.map((change, i) => {
        if (change.added){
          return `<li class="ins">${change.value}</li>`;
        }
        if (change.removed){
          return `<li class="del">${change.value}</li>`;
        }
      });
      fileEvent.emit('changed file', new_changes.join('\n'));
    }
    old_file = new_file
  });
});

//When the `changed file` event fires, log changes locally
fileEvent.on('changed file', function(data){
  console.log(`The file was changed and fired an event. This are the changes:\n${data}`);
});

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);

// send a message on successful socket connection
io.on('connection', function(socket){
  socket.emit('message', 'Successfully connected.');
  //test if client receives data
  socket.on('message received', function(data){
    console.log('Client is saying:' + data)
  })

});

//when `changed file` event fires, send changes to browser
fileEvent.on(`changed file`, function(data){
  io.emit('diffed changes', data);
});


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = { app, io };
