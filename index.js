const express=require("express");
const cors = require("cors");
const bodyparser=require('body-parser');
const cookieParser=require("cookie-parser");
const app=express();
const router=require('./router/router.js');
//解决跨域
app.use(cors());
//导入bodyparser获取前端传过来的数据
app.use(bodyparser.json());
app.use(express.static('./dist'))
app.use(bodyparser.urlencoded({extended:false}));
app.use(router);
//使用cookieParser生成cookie
app.use(cookieParser());
app.listen(80,function(){
    console.log('http://127.0.0.1');
});