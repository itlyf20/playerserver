const mongoose = require('mongoose');
// var database_name = 'mongodb://test:tf12345@47.110.127.183:27017/test';
var database_name = 'mongodb://guest:tf12345@47.88.48.46:26666/?authSource=test';

function connect(callback) {
    mongoose.connect(database_name, {useNewUrlParser: true, useUnifiedTopology: true}, (err, db) => {
        if (err){
            callback(err,null);
            return;
        }else{
            callback(err,db)
        }
    })
}
module.exports = connect;

