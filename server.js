const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const cors = require('cors');

const mongoose = require('mongoose');
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track', { useNewUrlParser: true } ); 

const shortid = require('shortid');
app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

const Users = new mongoose.Schema({
 username: {
  type: String,
  required: true,
  unique: true
 },
 _id: {
  type: String,
  required: true,
  unique: true  
 }
});
const User = mongoose.model("User", Users);

const Exs = new mongoose.Schema({
 user: {
  type: String,
  ref: "User" 
 },
exercises: [{ 
 description: {
  type: String,
  required: true
 },
 duration: {
  type: Number,
  required: true
 },
 date: {
  type: String,
  default: new Date(Date.now()).toDateString()
 } 
 }]
});
const Ex = mongoose.model("Ex", Exs);

app.post("/api/exercise/new-user", function(req, res) {
  let name = req.body.username;
 function createId() {
  let id = shortid.generate();
   return User.findOne({_id: id}, function(err, data) {
    if(err) { return res.json({error: err}); }
  if(!data) {
   let user = new User({username: name, _id: id});
    user.save(function(err, data) {
  if(err) { return res.json({error: err}); }
  res.json({username: name, _id: id}); 
    });
  } else {
  createId();
  }
  }); 
  }
  function tryName() {
   User.findOne({username: name}, function(err, data) { 
    if(err) { return res.json({error: err}); } 
    return data ? res.json({error: 'Name must be unique'}) : createId();
  });
  } 
  name? tryName() : res.json({error: "Path `username` is required."}); 
 });

app.post("/api/exercise/add", function(req, res) {
  User.findOne({_id: req.body.userId}, function(err, data) {
  if(err) { return res.json({error: err}); }
  if(!data) { return res.json({error: 'There is no user with this id'}); }
    Ex.findOne({user: data._id}, function(err, data) {
     if(err) return res.json({error: err});
         if(!data) {
       var ex=new Ex({user: req.body.userId, exercises:[{description: req.body.description, duration: req.body.duration}]});
          if(req.body.date) { 
            var d=new Date(req.body.date).toDateString();  
            if(d!='Invalid Date'){ex.exercises[0].date=d;} 
          }
          ex.save(function(err, data) {
            if(err) {
         if(err.errors) { 
    let e = Object.keys(err.errors)[0]; 
    err = err.errors[e].message;
      }
      return res.json({error: err}); 
          } 
            Ex.findOne({_id: data._id}).populate("user").exec(function(err, data) {
        if(err) return res.json({error: err});      
  res.json({username: data.user.username, _id: data.user._id, description: data.exercises[data.exercises.length-1].description, duration: data.exercises[data.exercises.length-1].duration, date: data.exercises[data.exercises.length-1].date});
          });
          });
        } else { 
        data.exercises.push({description: req.body.description, duration: req.body.duration});
          if(req.body.date) { 
            var d=new Date(req.body.date).toDateString();
            if(d!='Invalid Date'){data.exercises[data.exercises.length-1].date=d;}
          } 
        data.save(function(err, data) { 
          if(err) {
         if(err.errors) { 
    let e = Object.keys(err.errors)[0]; 
    err = err.errors[e].message;
      }
      return res.json({error: err}); 
          } 
          Ex.findOne({_id: data._id}).populate("user").exec(function(err, data) {
            if(err) return res.json({error: err});
  res.json({_id: data.user._id, username: data.user.username, description: data.exercises[data.exercises.length-1].description, duration: data.exercises[data.exercises.length-1].duration, date: data.exercises[data.exercises.length-1].date});
          });
        });
        }
      });
  });
});

app.get("/api/exercise/users", function(req, res) {
  User.find(function(err, data) {
  if(err) { return res.json({error: err}); }
    res.json(data);
  });
});

app.get("/api/exercise/log", function(req, res) {
  User.findOne({_id: req.query.userId}, function(err, user) {
    if(err) return res.json({error: err});
    if(!user) { return res.json({error: 'There is no user with this id'}); }
  Ex.findOne({user: req.query.userId}, function(err, exer) {
  if(err) return res.json({error: err});
    let filtered = exer.exercises.slice();
    let answer = {_id: user._id, username: user.username, count: exer.exercises.length};
    if(req.query.from&&new Date(req.query.from)!='Invalid Date') {
      answer.from = new Date(req.query.from);
    filtered = filtered.filter(function(val) {
    return new Date(val.date)>=new Date(req.query.from);
    });
    }
    if(req.query.to&&new Date(req.query.to)!='Invalid Date') {
      answer.to = new Date(req.query.to);
    filtered = filtered.filter(function(val) {
    return new Date(val.date)<=new Date(req.query.to);
    });   
    }
  if(req.query.limit) {
      let limit = Number(req.query.limit);
      if(!isNaN(limit)&&filtered.length>req.query.limit&&req.query.limit>=0) {
    filtered.length = req.query.limit;
      } 
  }  
   answer.exercises = filtered;
    res.json(answer);
  });
});
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'});
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error';
  }
  res.status(errCode).type('txt')
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
