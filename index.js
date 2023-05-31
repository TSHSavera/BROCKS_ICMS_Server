
const express = require('express');
const cors = require("cors");
const db=require('./routes/dbconfig');
const corsOptions ={
    origin:'*', 
    credentials:false,            //access-control-allow-credentials:true
    optionSuccessStatus:200,
    method: 'GET POST',
    headers: ['Access-Control-Allow-Origin', 'Content-Type'],
};

const app = express();

app.use(cors(corsOptions));
app.use(express.json());
const { StatusCodes, ReasonPhrases } = require("http-status-codes");

app.use(cors());

app.get("/", (req, res) => {
    res.status(StatusCodes.OK).json({
      title: "Waiting for request...",
      status: StatusCodes.OK,
    });
    console.log("Home request was received from: " + req.headers.host);
  });

// Route OG
function upsRoute(req, res) {
  console.log("UPS Main request was received from: " + req.headers.host);
      if(
        req.body == null ||
        req.body.id == null ||
        req.body.available == null
      ) {
        console.log("error");
        res.redirect(406, '/');
        return;
      }

      var id = req.body.id;
      var av = req.body.available;
      var un = req.body.uname;

      //Perform lookup
      var lu = "SELECT * FROM `pc_status` WHERE `uname` = '" + un + "'";
      db.query(lu, function(err, result) {
        console.log(result);
        res.uierr = {};
        if (err) throw err;
        if (result.length != 0) {
          res.uierr.info = "Username is currently seated on a pc.";
          console.log("UPS request from " + req.headers.host + " was fulfilled with error. " + un +" is currently seated on " + result[0].id);
          res.redirect(406, '/');
          return;
        } else {
          var lu2 = "SELECT * FROM `user_data` WHERE `uname` = '" + un + "'";
          db.query(lu2, function(err, result) {
            if (err) throw err;
            if (result.length != 1 && av == 2) {
              res.uierr.info = "Username doesn't exists in the db!";
              res.redirect(406, '/');
              console.log(res);
              console.log("UPS request from " + req.headers.host + " was fulfilled with error." + un + " doesn't exists in the db!");
            } else {
              var sql;
              if (av == 2) {
                sql = "UPDATE `pc_status` SET `available` = " + av + " ,`uname` = '" + un + "' WHERE `id` = '" + id + "'";
              } else {
                sql = "UPDATE `pc_status` SET `available` = " + av + " ,`uname` = NULL WHERE `id` = '" + id + "'";
              }
              db.query(sql, function(err, result) {
              if (err) throw err;
                console.log('Status of PC ' + req.body.id + ' was changed to ' + req.body.available + '. ' + 'Unit is being used by: ' + req.body.uname);
                console.log("UPS request from " + req.headers.host + " was fulfilled.");
                res.redirect(200 ,'/');
              });
            }
          });
        }
      });
    }
    //Define route
    app.post("/ups", upsRoute);


    //Set time by seconds
app.post("/utr/setsecs", (req, res) => {
  console.log("UTR request was received from: " + req.headers.host);
      if(
        req.body == null ||
        req.body.uname == null ||
        req.body.time == null
      ) {
        console.log("error");
      }

      var uname = req.body.uname;
      var t = req.body.time;

      //Perform Lookup
      var lu = "SELECT `uname` FROM `user_deets` WHERE `uname` = '" + uname + "'";
      //Perform Query Ops
      var sql = "UPDATE `user_data` SET time = " + t + " WHERE `uname` = '" + uname + "'";
      db.query(sql, function(err, result) {
      console.log(result);
      if (err) throw err;
      if (result.affectedRows == 0) {
        res.redirect(406, '/');
        console.log("UTR request from " + req.headers.host + " was fulfilled with error. No such username exists in the records!");
      } else {
        console.log('Time data of ' + req.body.uname + ' was changed to ' + req.body.time + ' seconds');
        console.log("UTR request from " + req.headers.host + " was fulfilled.");
        res.redirect(200 ,'/');
      }
      });
});

const intervals = [];
let sesid = 0;
// Start user session
  app.get("/startSession/:uname", (req, res) => {
    console.log("startSession request of user " + req.params.uname + " was received from: " + req.headers.host);
    const uname = req.params.uname;
    //Check if the user had already started his/her session
    var lu = "SELECT `sesid` FROM `user_data` WHERE `uname` = '" + uname + "'";
    db.query(lu, (err, result) => {
      if (err) throw err;
      if (result[0].sesid != -1) {
        console.error("startSession request from " + req.headers.host + " was fulfilled with error. User already have a session.");
        res.redirect(406, '/');
        return false;
      }
    });
    //Get the user's remaining time on db
    var sql = "SELECT `time` FROM `user_data` WHERE `uname` = '" + uname + "'";
    db.query(sql, (err, result) => {
      if (err) throw err;
      //Check if there's a data
      if (result.length == 0) {
        console.log("startSession request from " + req.headers.host + " was fulfilled with error. No such username exists in the records!");
        res.redirect(406, '/');
        return;
      }
      if (result[0].time == 0) {
        console.log("Request rejected. Time is 0");
        res.redirect(406, '/');
        return;
      }
      //Decrement time
      const intervalId = setInterval(() => {
        var sql = "UPDATE `user_data` SET `time` = time - 1 WHERE `uname` = '" + uname + "'";
        db.query(sql, (err, result) => {
          if (err) throw err;
          var sql = "SELECT `time` FROM `user_data` WHERE `uname` = '" + uname + "'";
          db.query(sql, (err, result) => {
            if (err) throw err;
            if (result[0].time > 0) {
              console.log(uname + "'s time is ticking. " + result[0].time + "s remaining.");
            } else {
              var sql = "SELECT * FROM `user_data` WHERE `uname` = '" + uname + "'";
              db.query(sql, (err, result) => {
                if (err) throw err;
                console.log(result[0].sesid);
                clearInterval(intervals[result[0].sesid]);
                console.log(uname + " time is up!");
                var sql = "UPDATE `user_data` SET `sesid` = -1 WHERE `uname` = '" + uname + "'";
                db.query(sql, (err, result) => {
                  if (err) throw err;
                  console.log("Sesid of " + uname + " was set to -1");
                });
                //Call UPS to update the PC Status
                var sql2 = "SELECT `id` FROM `pc_status` WHERE `uname` = '" + uname + "'";
                db.query(sql2, (err, result) => {
                  if (err) throw err;
                  const payload = {  
                    id: result[0].id,   
                    available: 1,  
                    uname: null    
                  };
                  
                  upsRouteS(req, res, payload);
                });
                
              });
            }
          });
        });
      }, 1000);

      intervals.push(intervalId);
      //Get the length of intervals, then assign a sesid for us to stop the interval assigned. Push it to db for later use.
      var sql = "UPDATE `user_data` SET `sesid` = " + sesid + " WHERE `uname` = '" + uname + "'";
      db.query(sql, (err, result) => {
        if (err) throw err;
        console.log( uname + " sesid value is " + sesid);
        sesid++;
      });
      console.log(intervals);
    });
    //res.redirect(200, '/');
  });

  //Overload
  function upsRouteS(req, res, payload) {
    req.body = payload;
    console.log("UPS SES request was received from: " + req.headers.host);
    console.log(req.body);
        if(
          req.body == null ||
          req.body.id == null ||
          req.body.available == null
        ) {
          console.log("error");
          res.redirect(406, '/');
          return;
        }
  
        var id = req.body.id;
        var av = req.body.available;
        var un = req.body.uname;
  
        //Perform lookup
        var lu = "SELECT * FROM `pc_status` WHERE `uname` = '" + un + "'";
        db.query(lu, function(err, result) {
          console.log(result);
          res.uierr = {};
          if (err) throw err;
          if (result.length != 0) {
            res.uierr.info = "Username is currently seated on a pc.";
            console.log("UPS request from " + req.headers.host + " was fulfilled with error. " + un +" is currently seated on " + result[0].id);
            res.redirect(406, '/');
            return;
          } else {
            var lu2 = "SELECT * FROM `user_data` WHERE `uname` = '" + un + "'";
            db.query(lu2, function(err, result) {
              if (err) throw err;
              if (result.length != 1 && av == 2) {
                res.uierr.info = "Username doesn't exists in the db!";
                res.redirect(406, '/');
                console.log(res);
                console.log("UPS request from " + req.headers.host + " was fulfilled with error." + un + " doesn't exists in the db!");
              } else {
                var sql;
                if (av == 2) {
                  sql = "UPDATE `pc_status` SET `available` = " + av + " ,`uname` = '" + un + "' WHERE `id` = '" + id + "'";
                } else {
                  sql = "UPDATE `pc_status` SET `available` = " + av + " ,`uname` = NULL WHERE `id` = '" + id + "'";
                }
                db.query(sql, function(err, result) {
                if (err) throw err;
                  console.log('Status of PC ' + req.body.id + ' was changed to ' + req.body.available + '. ' + 'Unit is being used by: ' + req.body.uname);
                  console.log("UPS request from " + req.headers.host + " was fulfilled.");
                  res.redirect(200 ,'/');
                });
              }
            });
          }
        });
      }

  //Stop Session
  app.get("/stopSession/:uname", (req, res) => {
    console.log("stopSession request of user " + req.params.uname + " was received from: " + req.headers.host);
    const hdg = req.params.uname;
    //Get the user's sesid
    var sql = "SELECT `sesid` FROM `user_data` WHERE `uname` = '" + hdg+ "'";
    db.query(sql, (err, result) => {
      if (err) throw err;
      if (result[0].sesid == -1) {
        console.log("Interval was already stopeed");
        console.log("stopSession request from " + req.headers.host + " was fulfilled.");  
        res.redirect(200, '/');
      } else {
        if (err) throw err;
        var c = result[0].sesid;
        clearInterval(intervals[c]);
        delete intervals[c];
        console.log("Successfully stopped");
        //Set sesid to -1
        var sql = "UPDATE `user_data` SET `sesid` = -1 WHERE `uname` = '" + hdg + "'";
          db.query(sql, (err, result) => {
          if (err) throw err;
          console.log("Sesid of " + hdg + " was set to -1");
          console.log("stopSession request from " + req.headers.host + " was fulfilled.");   
        });
        res.redirect(200, '/');
      }
    });
  });


  //Get User Time
  app.get("/getUserTime/:uname", (req,res) => {
    console.log("getUserTime request of user " + req.params.uname + " was received from: " + req.headers.host);
    const uname = req.params.uname;
    //Get the user's time remaining on db
    var sql = "SELECT `time` FROM `user_data` WHERE `uname` = '" + uname + "'";
    db.query(sql, (err, result) => {
      if (err) throw err;
      if (result.length == 0) {
        console.log("getUserTime request from " + req.headers.host + " was fulfilled with error. No such username exists in the records!");
        res.redirect(406, '/');
        return;
      }
      const tr = result[0].time;
      console.log("getUserTime request from " + req.headers.host + " was fulfilled.");  
      res.json({tr});
    });
  });

  //Add user time
app.post("/utr/add", (req, res) => {
  console.log("UTR Add request was received from: " + req.headers.host);
      if(
        req.body == null ||
        req.body.uname == null ||
        req.body.time == null
      ) {
        console.log("error");
        res.redirect(406, '/');
        return;
      }

      var uname = req.body.uname;
      var t = req.body.time;
      console.log("Time to add: " + t);
      //Perform Lookup
      var lu = "SELECT `uname` FROM `user_deets` WHERE `uname` = '" + uname + "'";
      db.query(lu, function(err, result) {
        if (err) throw err;
        if (result.length == 0) {
          console.log("UTR Add request from " + req.headers.host + " was fulfilled with error. No such username exists in the records!");
          res.redirect(406, '/');
          return;
        }
      });
      //Perform Query Ops
      var sql = "UPDATE `user_data` SET time = time + " + t + " WHERE `uname` = '" + uname + "'";
      db.query(sql, function(err, result) {
      //console.log(result);
      if (err) throw err;
      if (result.affectedRows == 0) {
        res.redirect(406, '/');
        console.log("UTR Add request from " + req.headers.host + " was fulfilled with error. No such username exists in the records!");
      } else {
        console.log('Time data of ' + req.body.uname + ' was changed');
        console.log("UTR Add request from " + req.headers.host + " was fulfilled.");
        res.redirect(200 ,'/');
      }
      });
});

//Add Points
app.post("/upm", (req, res) => {
  console.log("UPM request was received from: " + req.headers.host);
  if (
    req.body == null ||
    req.body.uname == null ||
    req.body.points == null ||
    req.body.mode == null
  ) {
    console.log(req.body);
    console.log("error");
    res.redirect(406, '/');
    return;
  }

  let un = req.body.uname;
  let pts = req.body.points;
  let mode = req.body.mode;
  //Add to the db
  var sql;
  if (mode == 1) {
    //Set Mode
    sql = "UPDATE `user_data` SET `points` = " + pts + " WHERE `uname` = '" + un + "'";
  } else if (mode == 2) {
    //Add Mode
    sql = "UPDATE `user_data` SET `points` = points + " + pts + " WHERE `uname` = '" + un + "'";
  } else if (mode == 3) {
    //Subtract Mode
    sql = "UPDATE `user_data` SET `points` = points - " + pts + " WHERE `uname` = '" + un + "'";
  }
  db.query(sql, (err, result) => {
    if (err) throw err;
    if (result.affectedRows != 0) {
      if (mode == 1) {
        console.log("Successfully set " + un + "'s points to " + pts);
      } else if (mode == 2) {
        console.log("Successfully added " + pts + " points to " + un);
      } else if (mode == 2) {
        console.log("Successfully taken " + pts + " points from " + un);
      }
      res.redirect(200, '/');
    } else {
      console.log("There's no such username found!");
      res.redirect(406, '/');
    }
  });
});

//Get points
app.get("/getUserPts/:uname", (req,res) => {
  console.log("getUserPts request of user " + req.params.uname + " was received from: " + req.headers.host);
  const uname = req.params.uname;
  //Get the user's time remaining on db
  var sql = "SELECT `points` FROM `user_data` WHERE `uname` = '" + uname + "'";
  db.query(sql, (err, result) => {
    if (err) throw err;
    if (result.length == 0) {
      console.log("getUserPoints request from " + req.headers.host + " was fulfilled with error. No such username exists in the records!");
      res.redirect(406, '/');
      return;
    }
    const tr = result[0].points;
    console.log(tr);
    console.log("getUserPoints request from " + req.headers.host + " was fulfilled.");  
    res.json({tr});
  });
});

app.post("/upsfc", (req,res) => {
  console.log("UPSfc request was received from: " + req.headers.host);
  const un = req.body.uname;
  console.log(un);
  //Stop the session of a pc from username
  var sql = "UPDATE `pc_status` SET `uname` = NULL, `available` = 1 WHERE `uname` = '" + un + "'";
  db.query(sql, (err, result) => {
    if (err) throw err;
    if (result.length == 0) {
      console.log("UPSfc request from " + req.headers.host + " was fulfilled with error. No such username exists.");
      res.redirect(406, '/');
      return;
    }
    console.log("UPSfc request from " + req.headers.host + " was fulfilled.");
    res.redirect(200, '/');
  });
})
// //Get all data
// app.get("/getUserData/:uname", (req, res) => {
//   console.log("getUserData request of user " + req.params.uname + " was received from: " + req.headers.host);
//   const uname = req.params.uname;
//   //Get the user's time remaining on db
//   var sql = "SELECT * FROM `user_data` WHERE `uname` = '" + uname + "'";
//   db.query(sql, (err, result) => {
//     if (err) throw err;
//     if (result.length == 0) {
//       console.log("getUserData request from " + req.headers.host + " was fulfilled with error. No such username exists in the records!");
//       res.redirect(406, '/');
//       return;
//     }
//     const tr = result[0];
//     console.log(tr);
//     console.log("getUserData request from " + req.headers.host + " was fulfilled.");  
//     res.json({tr});
//   });
// });


  app.all("*", (req, res, next) => {
    res.status(StatusCodes.METHOD_NOT_ALLOWED).json({
      status: StatusCodes.METHOD_NOT_ALLOWED,
      title: ReasonPhrases.METHOD_NOT_ALLOWED,
    });
    next();
  });

// port must be set to 3000 because incoming http requests are routed from port 80 to port 8080
app.listen(3000, function () {
    console.log('Node app is running on port 3000');
});
 
module.exports = app;