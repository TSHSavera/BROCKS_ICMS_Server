var mysql = require('mysql');
var con = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'brocks_data'
}); 
 
con.connect(function(err) {
  if (err) throw err;
  console.log('Successfully connected to the database!');
});
module.exports = con;