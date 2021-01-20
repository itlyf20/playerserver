let express = require("express");
let path = require("path"); //系统路径模块
let fs = require("fs"); //文件模块
let jwt = require("jsonwebtoken");
let OSS=require("ali-oss");
let key = "sdfafjkjsdjflkdskjfk";
const router = express.Router();
const format = require("../public/retention");
const connect = require("../db/db");

//玩家信息查询
router.post("/playerinfo", (req, res) => {
	let uid = req.body.uid;
	let nickname = req.body.nickname;
	connect((err, db) => {
		if (err) {
			console.log("数据库链接失败！")
		} else {
			let userinfo = db.collection("userinfo");
			if (nickname === "") {
				userinfo.find({
					uid: parseInt(uid)
				}).toArray(function(err, result) {
					if (err) {
						return;
					} else {
						res.send({
							code: 200,
							result: result,
							msg: '请求数据成功'
						})
					}
				})
			} else if (uid === "") {
				userinfo.find({
					nickname: nickname
				}).toArray(function(err, result) {
					if (err) {
						return;
					} else {
						res.send({
							code: 200,
							result: result,
							msg: '请求数据成功'
						})
					}
				})
			} else {
				return;
			}
		}
	})
});

//新手引导
router.post('/noviceguide', (req, res) => {
	const first_time = parseInt(req.body.first_time);
	const last_time = parseInt(req.body.last_time);
	const server_id = parseInt(req.body.server_id);
	const map = new Map();
	let guides_arr = [];
	let new_guide_arr = [];
	let arr = [];
	//文件路径，__dirname为当前运行js文件的目录
	const file = path.join(__dirname, '../map/guides.json');
	//读取json文件
	fs.readFile(file, 'utf8', function(err, data) {
		if (err) {
			res.send('文件读取失败');
		} else {
			let guides = JSON.parse(data);
			guides.forEach(item => {
				guides_arr.push(item.event_id);
				map.set(item.event_id, item.description)
			});
			connect((err, db) => {
				if (err) {
					console.log("数据库链接失败！")
				} else {
					let new_guide = db.collection("new_guide");
					new_guide.aggregate([{
							$match: {
								$and: [{
										server_id: server_id
									},
									{
										date: {
											"$gte": first_time,
											"$lte": last_time
										}
									}
								],
							}
						},
						{
							$group: {
								_id: "$event_id",
								count: {
									$sum: 1
								}
							}
						},
					]).toArray(function(err, result) {
						if (err) {
							console.log('error:' + err);
							return;
						} else {
							result.forEach(item => {
								new_guide_arr.push({
									event_id: item._id,
									count: item.count
								});
							});
							new_guide_arr.sort(function(a, b) {
								return guides_arr.indexOf(a.event_id.toString()) - guides_arr.indexOf(b.event_id.toString());
							});
							new_guide_arr.forEach(item => {
								if (map.get(item.event_id.toString()) === undefined) {
									return;
								} else {
									let obj = {
										event_id: map.get(item.event_id.toString()),
										count: item.count
									};
									arr.push(obj)
								}
							});
							res.send({
								code: 200,
								msg: "success",
								result: arr
							})
						}
					})
				}
			})
		}
	});
});

//玩家充值信息
router.post("/recharge", (req, res) => {
	const uid = parseInt(req.body.uid);
	let arr = [];
	let dollarAll = 0;
	connect((err, db) => {
		if (err) {
			console.log("数据库链接失败！")
		} else {
			let recharge = db.collection("recharge");
			recharge.find({
				$and: [{
					uid: uid
				}]
			}).toArray(function(err, data) {
				if (err) {
					return;
				} else {
					data.forEach(item => {
						dollarAll += item.dollar;
					});
					data.forEach(item => {
						let obj = {
							server_id: item.server_id,
							uid: item.uid,
							date: item.date,
							dollar: item.dollar,
							recharge_id: item.recharge_id,
							gift_id: item.gift_id
						};
						arr.push(obj);
						arr.sort((a, b) => {
							return parseFloat(a.dollar) < parseFloat(b.dollar) ? 1 : -1;
						})
					});
					res.send({
						msg: '成功',
						code: 200,
						dollarAll: dollarAll,
						result: arr
					})
				}
			});
		}
	})
});

//礼包查询
router.post("/gift", (req, res) => {
	const first_time = parseInt(req.body.first_time);
	const last_time = parseInt(req.body.last_time);
	const server_id = parseInt(req.body.server_id);
	const gift_type = req.body.gift_type;
	let amounts = 0;
	let arr = [];
	let counts = 0;
	connect((err, db) => {
		if (err) {
			console.log("数据库链接失败！")
		} else {
			let recharge = db.collection("recharge");
			if (gift_type === "周期付费") {
				recharge.aggregate([{
						$match: {
							$and: [{
								date: {
									"$gte": first_time,
									"$lte": last_time
								}
							}, {
								recharge_id: {
									"$gte": 4,
									"$lte": 8,
									"$ne": 6
								}
							}, {
								server_id: server_id
							}],
						}
					},
					{
						$group: {
							_id: {
								recharge_id: "$recharge_id",
								dollar: "$dollar",
								server_id: "$server_id"
							},
							count: {
								$sum: 1
							},
						}
					}
				]).toArray(function(err, result) {
					if (err) {
						console.log('error:' + err);
						return;
					} else {
						result.forEach((item) => {
							amounts += item._id.dollar * item.count;
							counts += item.count;
						});
						result.forEach((item) => {
							let data = {
								recharge_id: item._id.recharge_id,
								dollar: parseFloat(item._id.dollar),
								gift_type: gift_type,
								server_id: item._id.server_id,
								amount: parseFloat((item._id.dollar * item.count).toFixed(2)),
								money_percentage: Math.round((item._id.dollar * item.count) / amounts * 10000) / (100.0).toFixed(2) + "%",
								count:  item.count,
								times_percentage: Math.round((item.count / counts) * 10000) / (100.0).toFixed(2) + "%",
							};
							arr.push(data);
							arr.sort((a, b) => {
								return parseFloat(a.amount) < parseFloat(b.amount) ? 1 : -1
							});
						});
						res.send({
							code: 200,
							msg: "success",
							result: arr
						})
					}
				})
			} else if (gift_type === "常驻日周月礼包") {
				recharge.aggregate([{
						$match: {
							$and: [{
								date: {
									"$gte": first_time,
									"$lte": last_time
								}
							}, {
								recharge_id: {
									"$gt": 10000,
									"$lt": 13000
								}
							}, {
								server_id: server_id
							}],
						}
					},
					{
						$group: {
							_id: {
								recharge_id: "$recharge_id",
								dollar: "$dollar",
								server_id: "$server_id"
							},
							count: {
								$sum: 1
							},
						}
					}
				]).toArray(function(err, result) {
					if (err) {
						console.log('error:' + err);
						return;
					} else {
						result.forEach((item) => {
							amounts += item._id.dollar * item.count;
							counts += item.count;
						});
						result.forEach((item) => {
							let data = {
								recharge_id: item._id.recharge_id,
								dollar: parseFloat(item._id.dollar),
								gift_type: gift_type,
								server_id: item._id.server_id,
								amount: parseFloat((item._id.dollar * item.count).toFixed(2)),
								money_percentage: Math.round((item._id.dollar * item.count) / amounts * 10000) / (100.0).toFixed(2) + "%",
								count:  item.count,
								times_percentage: Math.round((item.count / counts) * 10000) / (100.0).toFixed(2) + "%",
							};
							arr.push(data);
							arr.sort((a, b) => {
								return parseFloat(a.amount) < parseFloat(b.amount) ? 1 : -1
							});
						});
						res.send({
							code: 200,
							msg: "success",
							result: arr
						})
					}
				})
			} else if (gift_type === "新手礼包") {
				recharge.aggregate([{
						$match: {
							$and: [{
									date: {
										"$gte": first_time,
										"$lte": last_time
									}
								},
								{
									recharge_id: {
										"$in": [6, 9, 201, 202, 203, 204, 205, 206]
									}
								},
								{
									server_id: server_id
								}
							],
						}
					},
					{
						$group: {
							_id: {
								recharge_id: "$recharge_id",
								dollar: "$dollar",
								server_id: "$server_id"
							},
							count: {
								$sum: 1
							},
						}
					}
				]).toArray(function(err, result) {
					if (err) {
						console.log('error:' + err);
						return;
					} else {
						result.forEach((item) => {
							amounts += item._id.dollar * item.count;
							counts += item.count;
						});
						result.forEach((item) => {
							let data = {
								recharge_id: item._id.recharge_id,
								dollar: parseFloat(item._id.dollar),
								gift_type: gift_type,
								server_id: item._id.server_id,
								amount: parseFloat((item._id.dollar * item.count).toFixed(2)),
								money_percentage: Math.round((item._id.dollar * item.count) / amounts * 10000) / (100.0).toFixed(2) + "%",
								count:  item.count,
								times_percentage: Math.round((item.count / counts) * 10000) / (100.0).toFixed(2) + "%",
							};
							arr.push(data);
							arr.sort((a, b) => {
								return parseFloat(a.amount) < parseFloat(b.amount) ? 1 : -1
							});
						});
						res.send({
							code: 200,
							msg: "success",
							result: arr
						})
					}
				})
			} else if (gift_type === "推送礼包") {
				recharge.aggregate([{
						$match: {
							$and: [{
									date: {
										"$gte": first_time,
										"$lte": last_time
									}
								},
								{
									recharge_id: {
										"$gte": 13001
									}
								},
								{
									server_id: server_id
								}
							],
						}
					},
					{
						$group: {
							_id: {
								recharge_id: "$recharge_id",
								dollar: "$dollar",
								server_id: "$server_id"
							},
							count: {
								$sum: 1
							},
						}
					}
				]).toArray(function(err, result) {
					if (err) {
						console.log('error:' + err);
						return;
					} else {
						result.forEach((item) => {
							amounts += item._id.dollar * item.count;
							counts += item.count;
						});
						result.forEach((item) => {
							let data = {
								recharge_id: item._id.recharge_id,
								dollar: parseFloat(item._id.dollar),
								gift_type: gift_type,
								server_id: item._id.server_id,
								amount: parseFloat((item._id.dollar * item.count).toFixed(2)),
								money_percentage: Math.round((item._id.dollar * item.count) / amounts * 10000) / (100.0).toFixed(2) + "%",
								count:  item.count,
								times_percentage: Math.round((item.count / counts) * 10000) / (100.0).toFixed(2) + "%",
							};
							arr.push(data);
							arr.sort((a, b) => {
								return parseFloat(a.amount) < parseFloat(b.amount) ? 1 : -1
							});
						});
						res.send({
							code: 200,
							msg: "success",
							result: arr
						})
					}
				})
			} else {
				return;
			}
		}
	})
});

//挂机关卡
router.post("/hangup", (req, res) => {
	let first_time = parseInt(req.body.first_time);
	let last_time = parseInt(req.body.last_time);
	let server_id = parseInt(req.body.server_id);
	let map = new Map();
	let map1 = new Map();
	let counts = 0;let hangup_section = 0;
	let rankName = [];
	let file = path.join(__dirname, '../map/afkcheckpint.json'); //文件路径，__dirname为当前运行js文件的目录
	//读取json文件
	fs.readFile(file, 'utf8', function(err, data) {
		if (err) {
			res.send('文件读取失败');
		} else {
			let afkcheckpint = JSON.parse(data);
			afkcheckpint.forEach(item => {
				let hangup_section = item.chapter_id + '-' + item.verse_id;
				map.set(item.id, hangup_section);
				map1.set(item.old_id, hangup_section);
			});
			connect((err, db) => {
				if (err) {
					console.log("数据库链接失败！")
				} else {
					let userinfo = db.collection("userinfo");
					userinfo.aggregate([{
							$match: {
								$and: [{
										afkcheckpoint: {
											"$gt": 0
										}
									},
									{
										server_id: server_id
									},
									{
										reg_time: {
											"$gte": first_time,
											"$lte": last_time
										}
									}
								],
							}
						},
						{
							$group: {
								_id: {
									afkcheckpoint: "$afkcheckpoint",
									logout_time: "$logout_time",
									server_id: "$server_id",
									login_time: "$login_time"
								},
								count: {
									$sum: 1
								}
							}
						},
						{
							$sort: {
								_id: 1
							}
						}
					]).toArray(function(err, result) {
						if (err) {
							console.log('error:' + err);
							return;
						} else {
							//遍历数组，取出数据
							let newArr = [];
							result.forEach(item => {
								counts += item.count;
							});
							//将相同id的数据count叠加起来
							result.forEach(item => {
								const result = newArr.findIndex(ol => {
									return item._id.afkcheckpoint === ol._id.afkcheckpoint
								});
								if (result !== -1) {
									newArr[result].count = newArr[result].count + item.count
								} else {
									newArr.push(item)
								}
							});
							newArr.forEach(item => {
								if(item._id.logout_time===0)
								{
									let t = item._id.login_time - 1605196800;
									if (parseInt(t) <0) {
										//老id
										hangup_section = map1.get(item._id.afkcheckpoint.toString());
									} else {
										//新id
										hangup_section = map.get(item._id.afkcheckpoint.toString());
									}
									if (hangup_section === undefined){
										return;
									}
									let obj = {
										level_id: item._id.afkcheckpoint,
										hangup_section: hangup_section,
										server_id: item._id.server_id,
										hangup_count: item.count,
										hangup_proportion : Math.round((item.count) / counts * 10000) / (100.0).toFixed(2) + "%"
									};
									rankName.push(obj);
									rankName.sort((a, b) => {
										return a.hangup_count < b.hangup_count ? 1 : -1;
									})
								}else{
									let t = item._id.logout_time - 1605196800;
									if (parseInt(t) <0) {
										//老id
										hangup_section = map1.get(item._id.afkcheckpoint.toString());
									} else {
										//新id
										hangup_section = map.get(item._id.afkcheckpoint.toString());
									}
									if (hangup_section === undefined){
										return;
									}
									let obj = {
										level_id: item._id.afkcheckpoint,
										hangup_section: hangup_section,
										server_id: item._id.server_id,
										hangup_count: item.count,
										hangup_proportion : Math.round((item.count) / counts * 10000) / (100.0).toFixed(2) + "%"
									};
									rankName.push(obj);
									rankName.sort((a, b) => {
										return a.hangup_count < b.hangup_count ? 1 : -1;
									})
								}

							});
							res.send({
								code: 200,
								msg: "success",
								result: rankName
							});
						}
					});
				}
			})
		}
	});
});

//充值玩家分布
router.post('/playrecharge', (req, res) => {
	let server_id = parseInt(req.body.server_id);
	let number_of_people1 = 0;let number_of_people2 = 0;let number_of_people3 = 0;let number_of_people4 = 0;
	let number_of_people5 = 0;let number_of_people6 = 0;let number_of_people7 = 0;let number_of_people8 = 0;
	let number_of_people9 = 0;let number_of_people10 = 0;
	let sum_of_money1 = 0;let sum_of_money2 = 0;let sum_of_money5 = 0;let sum_of_money6 = 0;
	let sum_of_money7 = 0;let sum_of_money3 = 0;let sum_of_money4 = 0;let sum_of_money8 = 0;
	let sum_of_money9 = 0;let sum_of_money10 = 0;let total_recharge=0;
	connect((err, db) => {
		if (err) {
			console.log("数据库链接失败！")
		} else {
			let userinfo = db.collection("userinfo");
			userinfo.aggregate([{
					$match: {
						$and: [{
							server_id: server_id
						}, {
							total_recharge: {
								"$gt": 0
							}
						}]
					}
				},
				{
					$group: {
						_id: '$total_recharge',
						count: {
							$sum: 1
						}
					}
				},
				{
					$sort: {
						_id: 1
					}
				}
			]).toArray(function(err, result) {
				if (err) {
					console.log('error:' + err);
					return;
				} else {
					if (result.length > 0) {
						result.forEach((item) => {
							if (0 <= item._id && item._id < 1) {
								number_of_people1 += item.count;
							}
							if (1 <= item._id && item._id < 2) {
								number_of_people2 += item.count;
							}
							if (2 <= item._id && item._id < 5) {
								number_of_people3 += item.count;
							}
							if (5 <= item._id && item._id < 10) {
								number_of_people4 += item.count;
							}
							if (10 <= item._id && item._id < 20) {
								number_of_people5 += item.count;
							}
							if (20 <= item._id && item._id < 50) {
								number_of_people6 += item.count;
							}
							if (50 <= item._id && item._id < 100) {
								number_of_people7 += item.count;
							}
							if (100 <= item._id && item._id < 200) {
								number_of_people8 += item.count;
							}
							if (200 <= item._id && item._id < 500) {
								number_of_people9 += item.count;
							}
							if (item._id >= 500) {
								number_of_people10 += item.count;
							}
						});
						result.forEach((item) => {
							if (0 <= item._id && item._id < 1) {
								sum_of_money1 += item._id * item.count;
							}
							if (1 <= item._id && item._id < 2) {
								sum_of_money2 += item._id * item.count;
							}
							if (2 <= item._id && item._id < 5) {
								sum_of_money3 += item._id * item.count;
							}
							if (5 <= item._id && item._id < 10) {
								sum_of_money4 += item._id * item.count;
							}
							if (10 <= item._id && item._id < 20) {
								sum_of_money5 += item._id * item.count;
							}
							if (20 <= item._id && item._id < 50) {
								sum_of_money6 += item._id * item.count;
							}
							if (50 <= item._id && item._id < 100) {
								sum_of_money7 += item._id * item.count;
							}
							if (100 <= item._id && item._id < 200) {
								sum_of_money8 += item._id * item.count;
							}
							if (200 <= item._id && item._id < 500) {
								sum_of_money9 += item._id * item.count;
							}
							if (item._id >= 500) {
								sum_of_money10 += item._id * item.count;
							}
						});
						//总人数
						let total_number_of_people = number_of_people1 + number_of_people2 + number_of_people3 + number_of_people4 + number_of_people5 +
							number_of_people6 + number_of_people7 + number_of_people8 + number_of_people9 + number_of_people10;
						//人数占比
						let proportion_of_population1 =
							Math.round((number_of_people1 / total_number_of_people) * 10000) / (100.0).toFixed(2) +
							"%";
						let proportion_of_population2 =
							Math.round((number_of_people2 / total_number_of_people) * 10000) / (100.0).toFixed(2) +
							"%";
						let proportion_of_population3 =
							Math.round((number_of_people3 / total_number_of_people) * 10000) / (100.0).toFixed(2) +
							"%";
						let proportion_of_population4 =
							Math.round((number_of_people4 / total_number_of_people) * 10000) / (100.0).toFixed(2) +
							"%";
						let proportion_of_population5 =
							Math.round((number_of_people5 / total_number_of_people) * 10000) / (100.0).toFixed(2) +
							"%";
						let proportion_of_population6 =
							Math.round((number_of_people6 / total_number_of_people) * 10000) / (100.0).toFixed(2) +
							"%";
						let proportion_of_population7 =
							Math.round((number_of_people7 / total_number_of_people) * 10000) / (100.0).toFixed(2) +
							"%";
						let proportion_of_population8 =
							Math.round((number_of_people8 / total_number_of_people) * 10000) / (100.0).toFixed(2) +
							"%";
						let proportion_of_population9 =
							Math.round((number_of_people9 / total_number_of_people) * 10000) / (100.0).toFixed(2) +
							"%";
						let proportion_of_population10 =
							Math.round((number_of_people10 / total_number_of_people) * 10000) / (100.0).toFixed(2) +
							"%";

						//总金额
						total_recharge= sum_of_money1 + sum_of_money2 + sum_of_money3 + sum_of_money4 + sum_of_money5 +
							sum_of_money6 + sum_of_money7 + sum_of_money8 + sum_of_money9 + sum_of_money10;
						//金额占比
						let amount_proportion1 =
							Math.round((sum_of_money1 / total_recharge) * 10000) / (100.0).toFixed(2) +
							"%";
						let amount_proportion2 =
							Math.round((sum_of_money2 / total_recharge) * 10000) / (100.0).toFixed(2) +
							"%";
						let amount_proportion3 =
							Math.round((sum_of_money3 / total_recharge) * 10000) / (100.0).toFixed(2) +
							"%";
						let amount_proportion4 =
							Math.round((sum_of_money4 / total_recharge) * 10000) / (100.0).toFixed(2) +
							"%";
						let amount_proportion5 =
							Math.round((sum_of_money5 / total_recharge) * 10000) / (100.0).toFixed(2) +
							"%";
						let amount_proportion6 =
							Math.round((sum_of_money6 / total_recharge) * 10000) / (100.0).toFixed(2) +
							"%";
						let amount_proportion7 =
							Math.round((sum_of_money7 / total_recharge) * 10000) / (100.0).toFixed(2) +
							"%";
						let amount_proportion8 =
							Math.round((sum_of_money8 / total_recharge) * 10000) / (100.0).toFixed(2) +
							"%";
						let amount_proportion9 =
							Math.round((sum_of_money9 / total_recharge) * 10000) / (100.0).toFixed(2) +
							"%";
						let amount_proportion10 =
							Math.round((sum_of_money10 / total_recharge) * 10000) / (100.0).toFixed(2) +
							"%";
						let obj1 = {
							section: "[0-0.99]",
							number_of_people: number_of_people1,
							proportion_of_population: proportion_of_population1,
							sum_of_money: sum_of_money1.toFixed(2),
							amount_proportion: amount_proportion1,
						};
						let obj2 = {
							section: "[1-1.99]",
							number_of_people: number_of_people2,
							proportion_of_population: proportion_of_population2,
							sum_of_money: sum_of_money2.toFixed(2),
							amount_proportion: amount_proportion2,
						};
						let obj3 = {
							section: "[2-4.99]",
							number_of_people: number_of_people3,
							proportion_of_population: proportion_of_population3,
							sum_of_money: sum_of_money3.toFixed(2),
							amount_proportion: amount_proportion3,
						};
						let obj4 = {
							section: "[5-9.99]",
							number_of_people: number_of_people4,
							proportion_of_population: proportion_of_population4,
							sum_of_money: sum_of_money4.toFixed(2),
							amount_proportion: amount_proportion4,
						};
						let obj5 = {
							section: "[10-19.99]",
							number_of_people: number_of_people5,
							proportion_of_population: proportion_of_population5,
							sum_of_money: sum_of_money5.toFixed(2),
							amount_proportion: amount_proportion5,
						};
						let obj6 = {
							section: "[20-49.99]",
							number_of_people: number_of_people6,
							proportion_of_population: proportion_of_population6,
							sum_of_money: sum_of_money6.toFixed(2),
							amount_proportion: amount_proportion6,
						};
						let obj7 = {
							section: "[50-99.99]",
							number_of_people: number_of_people7,
							proportion_of_population: proportion_of_population7,
							sum_of_money: sum_of_money7.toFixed(2),
							amount_proportion: amount_proportion7,
						};
						let obj8 = {
							section: "[100-199.99]",
							number_of_people: number_of_people8,
							proportion_of_population: proportion_of_population8,
							sum_of_money: sum_of_money8.toFixed(2),
							amount_proportion: amount_proportion8,
						};
						let obj9 = {
							section: "[200-499.99]",
							number_of_people: number_of_people9,
							proportion_of_population: proportion_of_population9,
							sum_of_money: sum_of_money9.toFixed(2),
							amount_proportion: amount_proportion9,
						};
						let obj10 = {
							section: "[500+]",
							number_of_people: number_of_people10,
							proportion_of_population: proportion_of_population10,
							sum_of_money: sum_of_money10.toFixed(2),
							amount_proportion: amount_proportion10,
						};
						let arr = [];
						arr.push(obj1, obj2, obj3, obj4, obj5, obj6, obj7, obj8, obj9, obj10);
						arr.sort((a, b) => {
							return parseFloat(a.sum_of_money) < parseFloat(b.sum_of_money) ? 1 : -1;
						});
						res.send({
							code: 200,
							result: arr,
							total_recharge: total_recharge,
							msg: '获取成功'
						})
					} else {
						res.send({
							code: 400,
							msg: "没有对应的数据"
						});
						return;
					}
				}
			})
		}
	})
});

//档位充值分布
router.post('/gearecharge', (req, res) => {
	let server_id = parseInt(req.body.server_id);
	let first_time = parseInt(req.body.first_time);
	let last_time = parseInt(req.body.last_time);
	let total_amount = 0;
	let number_of_peoples = 0;
	let total_recharge = 0;
	let arr = [];
	connect((err, db) => {
		if (err) {
			console.log("数据库链接失败！")
		} else {
			let recharge = db.collection("recharge");
			recharge.aggregate([{
					$match: {
						$and: [{
							date: {
								"$gte": first_time,
								"$lte": last_time
							}
						}, {
							server_id: server_id
						}]
					}
				},
				{
					$group: {
						_id: "$dollar",
						count: {
							$sum: 1
						}
					}
				},
				{
					$sort: {
						_id: 1
					}
				}
			]).toArray(function(err, result) {
				if (err) {
					console.log('error:' + err);
					return;
				} else {
					result.forEach(item => {
						number_of_peoples += item.count;
						total_amount += item._id * item.count
					});
					result.forEach(item => {
						total_recharge += item._id * item.count;
						let obj = {
							dollar: parseFloat(item._id),
							sum_of_money: parseFloat((item._id * item.count).toFixed(2)),
							amount_proportion: (Math.round(((item._id * item.count) / total_amount * 10000))) / 100.00.toFixed(2) + '%',
							number_of_people:  item.count,
							proportion_of_population: (Math.round((item.count / number_of_peoples * 10000))) / 100.00.toFixed(2) + '%'
						};
						arr.push(obj);
						arr.sort((a, b) => {
							return parseFloat(a.sum_of_money) < parseFloat(b.sum_of_money) ? 1 : -1
						})
					});
					res.send({
						code: 200,
						result: arr,
						msg: '获取成功',
						total_recharge: total_recharge
					})
				}
			})
		}
	})
});

//登录
router.post("/login", async (req, res) => {
	const username = req.body.username;
	const password = req.body.password;
	let file = path.join(__dirname, '../map/user.json'); //文件路径，__dirname为当前运行js文件的目录
	//读取json文件
	await fs.readFile(file, 'utf8', function(err, data) {
		let token = jwt.sign({
			username: username
		}, key);
		res.cookie("token", token);
		if (err) {
			console.log(err);
			return;
		} else {
			if (data.length > 0) {
				//将数据库传来的数据转化为JSON格式
				let user_pwd1 = JSON.parse(data)[0].password;
				let user_pwd2 = JSON.parse(data)[1].password;
				if (user_pwd1 === password || user_pwd2 === password) {
					//将数据库的密码userPassword 和服务端 传来的密码相等
					res.json({
						code: 200,
						msg: '登录成功',
						user: username,
						token: token
					});
					return;
				} else {
					return res.json({
						status: 1,
						msg: '密码错误'
					})
				}
			}
		}
	});
});

//抽卡统计
router.post("/lottery", (req, res) => {
	let first_time = parseInt(req.body.first_time);
	let last_time = parseInt(req.body.last_time);
	let server_id = parseInt(req.body.server_id);
	let server= 0;
	let arr1 = [];let arr2 = [];let arr3 = [];let arr4 = [];let arr5 = [];
	connect(function(err, db) {
		if (err) {
			console.log("数据库链接失败！")
		} else {
			let lottery = db.collection("lottery");
			lottery.aggregate([{
					$match: {
						$and: [{
							date: {
								"$gte": first_time,
								"$lte": last_time
							}
						}, {
							server_id: server_id
						}, {
							lottery_id: 2
						}],
					}
				},
				{
					$group: {
						_id: {
							uid: "$uid",
							server_id: "$server_id",
							lottery_num: "$lottery_num"
						},
						count: {
							$sum: 1
						}
					}
				}
			]).toArray(function(err, result) {
				if (err) {
					console.log('error:' + err);
					return;
				} else {
					if (result.length > 0) {
						let newArr = [];
						result.forEach(item => {
							let obj = {
								uid: item._id.uid,
								server_id: item._id.server_id,
								lottery_num: item._id.lottery_num * item.count,
							};
							newArr.push(obj)
						});
						let resArr = [];
						//相同uid的数据去重，将lottery_num叠加起来获取抽卡的次数
						newArr.forEach(el => {
							const results = resArr.findIndex(ol => {
								return el.uid === ol.uid
							});
							if (results !== -1) {
								resArr[results].lottery_num = resArr[results].lottery_num + el.lottery_num
							} else {
								resArr.push(el);
							}
						});
						resArr.forEach(item => {
							if (1 <= item.lottery_num && item.lottery_num <= 10) {
								arr1.push(item.uid);
							}
							if (11 <= item.lottery_num && item.lottery_num <= 20) {
								arr2.push(item.uid);
							}
							if (21 <= item.lottery_num && item.lottery_num <= 50) {
								arr3.push(item.uid);
							}
							if (51 <= item.lottery_num && item.lottery_num <= 100) {
								arr4.push(item.uid);
							}
							if (item.lottery_num > 100) {
								arr5.push(item.uid);
							}
							server = item.server_id;
						});
						let total_player = arr1.length + arr2.length + arr3.length + arr4.length + arr5.length;
						let obj1 = {
							server: server,
							section: "[1-10]",
							number_of_players: arr1.length,
							proportion_of_players: (Math.round((arr1.length / total_player * 10000))) / 100.00.toFixed(2) + '%'
						};
						let obj2 = {
							server: server,
							section: "[11-20]",
							number_of_players: arr2.length,
							proportion_of_players: (Math.round((arr2.length / total_player * 10000))) / 100.00.toFixed(2) + '%'
						};
						let obj3 = {
							server: server,
							section: "[21-50]",
							number_of_players: arr3.length,
							proportion_of_players: (Math.round((arr3.length / total_player * 10000))) / 100.00.toFixed(2) + '%'
						};
						let obj4 = {
							server: server,
							section: "[51-100]",
							number_of_players: arr4.length,
							proportion_of_players: (Math.round((arr4.length / total_player * 10000))) / 100.00.toFixed(2) + '%'
						};
						let obj5 = {
							server: server,
							section: "[100+]",
							number_of_players: arr5.length,
							proportion_of_players: (Math.round((arr5.length / total_player * 10000))) / 100.00.toFixed(2) + '%'
						};
						let arr = [];
						arr.push(obj1, obj2, obj3, obj4, obj5);
						res.send({
							code: 200,
							msg: "success",
							result: arr
						})
					} else {
						res.send({
							code: 202,
							msg: "没有对应数据"
						})
					}
				}
			})
		}
	})
});

//角色阵容练度
router.post("/rolezr", (req, res) => {
	let uid = parseInt(req.body.uid);
	let map = new Map();
	let map1 = new Map();
	let counts = 0;let percentage_of_times = 0;let arr = [];let uid_s = '';
	let file = path.join(__dirname, '../map/role_attr.json'); //文件路径，__dirname为当前运行js文件的目录
	//读取json文件
	fs.readFile(file, 'utf8', function(err, data) {
		if (err) {
			res.send('文件读取失败');
		} else {
			let role_attr = JSON.parse(data);
			role_attr.forEach(item => {
				map.set(item.role_id, item.campType);
				map1.set(item.role_id, item.name);
			});
			connect(function(err, db) {
				if (err) {
					console.log("数据库链接失败！")
				} else {
					let userinfo = db.collection("userinfo");
					userinfo.aggregate([{
							$match: {
								$and: [{
									uid: uid
								}]
							}
						},
						{
							$unwind: "$role_format"
						},
						{
							$group: {
								_id: {
									uid: '$uid',
									in_crystal: '$role_format.in_crystal',
									role_id: '$role_format.role_id',
									role_level: '$role_format.role_level',
									role_power: '$role_format.role_power'
								},
								count: {
									$sum: 1
								}
							}
						}
					]).toArray(function(err, result) {
						if (err) {
							console.log('error:' + err);
							return;
						} else {
							result.forEach((item) => {
								counts += item.count;
								uid_s = item._id.uid;
							});
							result.forEach((item) => {
								percentage_of_times = item.count / counts.toFixed(6);
								let role_id = map1.get(item._id.role_id.toString());
								let in_crystal = item._id.in_crystal.toString();
								if (in_crystal === "true") {
									in_crystal = "是";
								} else {
									in_crystal = "否";
								}
								let role_level = item._id.role_level;
								let campType = map.get(item._id.role_id.toString());
								let role_power = item._id.role_power;
								let obj = {
									uid: uid_s,
									role_id: role_id,
									in_crystal: in_crystal,
									role_level: role_level,
									campType: campType,
									role_power: role_power,
									percentage_of_times: Math.round(percentage_of_times * 10000) / (100.0).toFixed(2) + "%",
								};
								arr.push(obj);
							});
							//排序
							arr.sort((a, b) => {
								return a.role_power < b.role_power ? 1 : -1
							});
							res.json({
								code: 200,
								msg: 'success',
								result: arr
							});
						}
					})
				}
			})
		}
	});
});

//留存率
router.post("/getfirstday", (req, res) => {
	const endDate = parseInt(req.body.endDate);
	connect(function(err, db) {
		if (err) {
			console.log("数据库链接失败！")
		} else {
			//根据系统的当前时间查询出最早注册的时间是多少
			db.collection("register").find({
				"register_time": {
					"$lt": endDate
				}
			}).sort({
				"register_time": 1
			}).limit(1).toArray((err, data) => {
				res.send(data)
			})
		}
	})
});
//留存率
router.post("/retention", (req, res) => {
	let start_time = parseInt(req.body.start_time);
	let next_time = start_time + (24 * 3600);
	connect(function(err, db) {
		if (err) {
			return;
		} else {
			let obj = {};
			let count1 = 0;let count2 = 0;let count3 = 0;let count4 = 0;
			let counts = 0;let dau = 0;let day = 0;
			let arr = [];let uid_s = [];let retention_Arr = [];
			if (err) {
				console.log(err);
				return;
			} else {
				db.collection("register").aggregate([{
						$match: {
							register_time: {
								$gte: start_time,
								$lt: next_time
							}
						}
					},
					{
						$group: {
							_id: {
								uid: "$uid",
								register_time: "$register_time"
							},
							count: {
								$sum: 1
							}
						}
					},
					{
						$sort: {
							_id: -1
						}
					}
				]).toArray(function(err, result) {
					if (err) {
						return;
					} else {
						result.forEach(item => {
							counts += item.count;
							uid_s.push(item._id.uid)
						});
						db.collection("sign_in").aggregate([{
								$match: {
									register_time: {
										$gte: start_time,
										$lt: next_time
									}
								}
							},
							{
								$group: {
									_id: {
										uid: "$uid",
										register_time: "$register_time",
										sign_in_date: "$sign_in_date"
									},
									count: {
										$sum: 1
									}
								}
							},
							{
								$sort: {
									_id: -1
								}
							}
						]).toArray(function(err, data) {
							//先将data遍历一下，取出对应的登录时间和注册时间去处掉所有的后面的时分秒后，直接存到另一个数组中，然后通过数组可以实现去重
							data.forEach(item => {
								let time1 = format.formatDate(new Date(item._id.sign_in_date * 1000));
								let time2 = format.formatDate(new Date(item._id.register_time * 1000));
								let datetime1 = (new Date(Date.parse(time1.replace(/-/g, "/"))).getTime()) / 1000;
								let datetime2 = (new Date(Date.parse(time2.replace(/-/g, "/"))).getTime()) / 1000;
								let objs = {
									count: item.count,
									register_time: datetime2,
									sign_in_date: datetime1,
									uid: item._id.uid
								};
								arr.push(objs)
							});
							const uid = "uid";
							//去掉uid相同的数据
							const newArr = arr.reduce((all, next) => all.some((atom) => atom[uid] === next[uid]) ? all : [...all,
								next
							], []);
							newArr.forEach(item => {
								//判断登录表中的uid是否在注册表中存在
								let uid = uid_s.indexOf(parseInt(item.uid));
								if (uid > -1) {
									retention_Arr.push(item);
									dau += item.count;
								}
							});
							retention_Arr.forEach(item => {
								if (item.register_time > item.sign_in_date) {
									return;
								} else {
									let count = item.sign_in_date - item.register_time;
									day = Math.floor(count / (24 * 3600));
									// 次日留存数
									if (day > 0 && day === 1) {
										count1 += item.count
									}
									// 三日留存数
									if (day > 0 && day === 3) {
										count2 += item.count
									}
									//七日留存数
									if (day > 0 && day === 7) {
										count3 += item.count
									}
									//十五日留存数
									if (day > 0 && day === 15) {
										count4 += item.count
									}
								}
							});
							let time = format.formatDate(new Date(start_time * 1000));
							if (counts > 0) {
								obj = {
									time: time,
									dau: dau,
									next_day_retention_rate: Math.round(count1 / counts * 10000) / (100.0).toFixed(2) + "%",
									three_day_retention_rate: Math.round(count2 / counts * 10000) / (100.0).toFixed(2) + "%",
									seven_day_retention_rate: Math.round(count3 / counts * 10000) / (100.0).toFixed(2) + "%",
									fifteen_day_retention_rate: Math.round(count4 / counts * 10000) / (100.0).toFixed(2) + "%",
								};
								res.send(obj);
							}
						})
					}
				})
			}
		}
	})
});

//种族抽次数
router.post("/race", (req, res) => {
	let first_time = parseInt(req.body.first_time);
	let last_time = parseInt(req.body.last_time);
	let server_id = parseInt(req.body.server_id);
	let arr2 = [];let arr3 = [];let arr4 = [];let arr5 = [];
	let arr6 = [];let arr7 = [];let arr8 = [];let arr9 = [];
	let arr20 = [];let arr1 = [];let arr10 = [];let arr11 = [];
	let arr12 = [];let arr13 = [];let arr14 = [];let arr15 = [];
	let arr16 = [];let arr17 = [];let arr18 = [];let arr19 = [];
	let player_count1 = 0;let player_count2 = 0;let player_count3 = 0;let player_count15 = 0;let player_count9 = 0;
	let player_count4 = 0;let player_count5 = 0;let player_count6 = 0;let player_count7 = 0;
	let player_count8 = 0;let player_count10 = 0;let player_count11 = 0;let player_count12 = 0;
	let player_count13 = 0;let player_count14 = 0;let player_count16 = 0;let player_count17 = 0;
	let player_count18 = 0;let player_count19 = 0;let player_count20 = 0;let server_ids = 0;
	connect(function(err, db) {
		if (err) {
			console.log("数据库链接失败！")
		} else {
			let lottery = db.collection("lottery");
			lottery.aggregate([{
					$match: {
						$and: [{
							date: {
								"$gte": first_time,
								"$lte": last_time
							}
						}, {
							server_id: server_id
						}]
					}
				},
				{
					$group: {
						_id: {
							lottery_id: "$lottery_id",
							uid: "$uid",
							server_id: "$server_id"
						},
						count: {
							$sum: 1
						}
					}
				},
			]).toArray(function(err, result) {
				if (err) {
					console.log('error:' + err);
					return;
				} else {
					if (result.length > 0) {
						result.forEach(item => {
							server_ids = item._id.server_id;
							if (0 <= item.count && item.count <= 10 && item._id.lottery_id === 7) {
								arr1.push(item._id.uid);
								player_count1 += item.count
							}
							if (11 <= item.count && item.count <= 20 && item._id.lottery_id === 7) {
								arr2.push(item._id.uid);
								player_count2 += item.count
							}
							if (21 <= item.count && item.count <= 50 && item._id.lottery_id === 7) {
								arr3.push(item._id.uid);
								player_count3 += item.count
							}
							if (51 <= item.count && item.count <= 100 && item._id.lottery_id === 7) {
								arr4.push(item._id.uid);
								player_count4 += item.count;
							}
							if (item.count > 100 && item._id.lottery_id === 7) {
								arr5.push(item._id.uid);
								player_count5 += item.count
							}
						});
						result.forEach(item => {
							if (1 <= item.count && item.count <= 10 && item._id.lottery_id === 10) {
								arr6.push(item._id.uid);
								player_count6 += item.count
							} else if (11 <= item.count && item.count <= 20 && item._id.lottery_id === 10) {
								arr7.push(item._id.uid);
								player_count7 += item.count;
							} else if (21 <= item.count && item.count <= 50 && item._id.lottery_id === 10) {
								arr8.push(item._id.uid);
								player_count8 += item.count;
							} else if (51 <= item.count && item.count <= 100 && item._id.lottery_id === 10) {
								arr9.push(item._id.uid);
								player_count9 += item.count
							} else if (item.count > 100 && item._id.lottery_id === 10) {
								arr10.push(item._id.uid);
								player_count10 += item.count
							}
						});
						result.forEach(item => {
							if (1 <= item.count && item.count <= 10 && item._id.lottery_id === 9) {
								arr11.push(item._id.uid);
								player_count11 += item.count;
							} else if (11 <= item.count && item.count <= 20 && item._id.lottery_id === 9) {
								arr12.push(item._id.uid);
								player_count12 += item.count
							} else if (21 <= item.count && item.count <= 50 && item._id.lottery_id === 9) {
								arr13.push(item._id.uid);
								player_count13 += item.count;
							} else if (51 <= item.count && item.count <= 100 && item._id.lottery_id === 9) {
								arr14.push(item._id.uid);
								player_count14 += item.count;
							} else if (item.count > 100 && item._id.lottery_id === 9) {
								arr15.push(item._id.uid);
								player_count15 += item.count
							}
						});
						result.forEach(item => {
							if (1 <= item.count && item.count <= 10 && item._id.lottery_id === 8) {
								arr16.push(item._id.uid);
								player_count16 += item.count
							} else if (11 <= item.count && item.count <= 20 && item._id.lottery_id === 8) {
								arr17.push(item._id.uid);
								player_count17 += item.count
							} else if (21 <= item.count && item.count <= 50 && item._id.lottery_id === 8) {
								arr18.push(item._id.uid);
								player_count18 += item.count
							} else if (51 <= item.count && item.count <= 100 && item._id.lottery_id === 8) {
								arr19.push(item._id.uid);
								player_count19 += item.count
							} else if (item.count > 100 && item._id.lottery_id === 8) {
								arr20.push(item._id.uid);
								player_count20 += item.count
							}
						});

						let obj1 = {
							race_draw_times: "[1-10]",
							water_frequency: player_count1,
							server_id: server_ids,
							water_population: arr1.length,
							number_of_fires: player_count6,
							number_of_fire_victims: arr6.length,
							wind_frequency: player_count11,
							wind_number: arr11.length,
							times: player_count16,
							number_of_people: arr16.length
						};
						let obj2 = {
							race_draw_times: "[11-20]",
							water_frequency: player_count2,
							server_id: server_ids,
							water_population: arr2.length,
							number_of_fires: player_count7,
							number_of_fire_victims: arr7.length,
							wind_frequency: player_count12,
							wind_number: arr12.length,
							times: player_count17,
							number_of_people: arr17.length
						};
						let obj3 = {
							race_draw_times: "[21-50]",
							water_frequency:player_count3,
							server_id: server_ids,
							water_population: arr3.length,
							number_of_fires: player_count8,
							number_of_fire_victims: arr8.length,
							wind_frequency: player_count3,
							wind_number: arr13.length,
							times: player_count18,
							number_of_people: arr18.length
						};
						let obj4 = {
							race_draw_times: "[51-100]",
							water_frequency: player_count4,
							server_id: server_ids,
							water_population: arr4.length,
							number_of_fires: player_count9,
							number_of_fire_victims: arr9.length,
							wind_frequency: player_count14,
							wind_number: arr14.length,
							times: player_count19,
							number_of_people: arr19.length
						};
						let obj5 = {
							race_draw_times: "[100+]",
							water_frequency: player_count5,
							water_population: arr5.length,
							server_id: server_ids,
							number_of_fires: player_count10,
							number_of_fire_victims: arr10.length,
							wind_frequency: player_count15,
							wind_number: arr15.length,
							times: player_count20,
							number_of_people: arr20.length
						};
						let arr = [];
						arr.push(obj1, obj2, obj3, obj4, obj5);
						res.send({
							code: 200,
							result: arr,
							msg: '获取成功'
						})
					} else {
						res.send({
							code: 202,
							msg: "没有对应数据"
						});
						return;
					}
				}
			})
		}
	})
});

//商城购买
router.post("/shopbuy", (req, res) => {
	let first_time = parseInt(req.body.first_time);
	let last_time = parseInt(req.body.last_time);
	let server_id = parseInt(req.body.server_id);
	let shop_id = parseInt(req.body.shop_id);
	let map1 = new Map();
	let map2 = new Map();
	let map3 = new Map();
	let arr = [];
	let money_consume = 0;
	let file = path.join(__dirname, '../map/goods.json'); //文件路径，__dirname为当前运行js文件的目录
	//读取json文件
	fs.readFile(file, 'utf8', function(err, data) {
		if (err) {
			res.send('文件读取失败');
		} else {
			let goods = JSON.parse(data);
			goods.forEach(item => {
				map1.set(item.product_id, item.wp_name);
				map3.set(item.product_id, item.name)
			});
			let files = path.join(__dirname, '../map/shopbuy.json'); //文件路径，__dirname为当前运行js文件的目录
			//读取json文件
			fs.readFile(files, 'utf8', function(err, data) {
				if (err) {
					res.send('文件读取失败');
				} else {
					let result = JSON.parse(data);
					result.forEach((item) => {
						map2.set(item.shop_id, item.name);
					});
					connect(function(err, db) {
						if (err) {
							console.log("数据库链接失败！")
						} else {
							let shopbuy = db.collection("shopbuy");
							if (shop_id === 1001) {
								shopbuy.aggregate([{
										$match: {
											$and: [{
													server_id: server_id
												},
												{
													shop_id: shop_id
												},
												{
													date: {
														"$gte": first_time,
														"$lte": last_time
													}
												}
											]
										}
									},
									{
										$group: {
											_id: {
												product_id: "$product_id",
												shop_id: "$shop_id",
												server_id: "$server_id",
												money_type: "$money_type",
												money_cost: "$money_cost",
												money_id: "$money_id"
											},
											count: {
												$sum: 1
											}
										}
									},
								]).toArray(function(err, results) {
									if (err) {
										console.log('error:' + err);
										return;
									} else {
										results.forEach(item => {
											money_consume += item._id.money_cost
										});
										results.forEach(item => {
											let obj = {
												product_name: map3.get(item._id.product_id),
												server_id: item._id.server_id,
												shop_type: map2.get(item._id.shop_id),
												money_type: item._id.money_type,
												money_cost: item._id.money_cost,
												gm_count: item.count,
												money_consume: (item._id.money_cost / money_consume).toFixed(7)
											};
											arr.push(obj);
											arr.sort((a, b) => {
												return a.gm_count < b.gm_count ? 1 : -1
											});
										});
										res.send({
											code: 200,
											msg: "success",
											result: arr,
										})
									}
								})
							} else if (shop_id === 1002) {
								shopbuy.aggregate([{
										$match: {
											$and: [{
													server_id: server_id
												},
												{
													shop_id: shop_id
												},
												{
													date: {
														"$gte": first_time,
														"$lte": last_time
													}
												}
											]
										}
									},
									{
										$group: {
											_id: {
												product_id: "$product_id",
												shop_id: "$shop_id",
												server_id: "$server_id",
												money_type: "$money_type",
												money_cost: "$money_cost",
												money_id: "$money_id"
											},
											count: {
												$sum: 1
											}
										}
									},
								]).toArray(function(err, results) {
									if (err) {
										console.log('error:' + err);
										return;
									} else {
										results.forEach(item => {
											money_consume += item._id.money_cost
										});
										results.forEach(item => {
											let obj = {
												product_name: map3.get(item._id.product_id),
												server_id: item._id.server_id,
												shop_type: map2.get(item._id.shop_id),
												money_type: item._id.money_type,
												money_cost: item._id.money_cost,
												gm_count: item.count,
												money_consume: (item._id.money_cost / money_consume).toFixed(7)
											};
											arr.push(obj);
											arr.sort((a, b) => {
												return a.gm_count < b.gm_count ? 1 : -1
											});
										});
										res.send({
											code: 200,
											msg: "success",
											result: arr,
										})
									}
								})
							} else if (shop_id === 2001) {
								shopbuy.aggregate([{
										$match: {
											$and: [{
													server_id: server_id
												},
												{
													shop_id: shop_id
												},
												{
													date: {
														"$gte": first_time,
														"$lte": last_time
													}
												}
											]
										}
									},
									{
										$group: {
											_id: {
												product_id: "$product_id",
												shop_id: "$shop_id",
												server_id: "$server_id",
												money_type: "$money_type",
												money_cost: "$money_cost",
												money_id: "$money_id"
											},
											count: {
												$sum: 1
											}
										}
									},
								]).toArray(function(err, results) {
									if (err) {
										console.log('error:' + err);
										return;
									} else {
										results.forEach(item => {
											money_consume += item._id.money_cost
										});
										results.forEach(item => {
											let obj = {
												product_name: map3.get(item._id.product_id),
												server_id: item._id.server_id,
												shop_type: map2.get(item._id.shop_id),
												money_type: item._id.money_type,
												money_cost: item._id.money_cost,
												gm_count: item.count,
												money_consume: (item._id.money_cost / money_consume).toFixed(7)
											};
											arr.push(obj);
											arr.sort((a, b) => {
												return a.gm_count < b.gm_count ? 1 : -1
											});
										});
										res.send({
											code: 200,
											msg: "success",
											result: arr,
										})
									}
								})
							} else if (shop_id === 3001) {
								shopbuy.aggregate([{
										$match: {
											$and: [{
													server_id: server_id
												},
												{
													shop_id: shop_id
												},
												{
													date: {
														"$gte": first_time,
														"$lte": last_time
													}
												}
											]
										}
									},
									{
										$group: {
											_id: {
												product_id: "$product_id",
												shop_id: "$shop_id",
												server_id: "$server_id",
												money_type: "$money_type",
												money_cost: "$money_cost",
												money_id: "$money_id"
											},
											count: {
												$sum: 1
											}
										}
									},
								]).toArray(function(err, results) {
									if (err) {
										console.log('error:' + err);
										return;
									} else {
										results.forEach(item => {
											money_consume += item._id.money_cost
										});
										results.forEach(item => {
											let obj = {
												product_name: map3.get(item._id.product_id),
												server_id: item._id.server_id,
												shop_type: map2.get(item._id.shop_id),
												money_type: item._id.money_type,
												money_cost: item._id.money_cost,
												gm_count: item.count,
												money_consume: (item._id.money_cost / money_consume).toFixed(7)
											};
											arr.push(obj);
											arr.sort((a, b) => {
												return a.gm_count < b.gm_count ? 1 : -1
											});
										});
										res.send({
											code: 200,
											msg: "success",
											result: arr,
										})
									}
								})
							} else if (shop_id === 4001) {
								shopbuy.aggregate([{
										$match: {
											$and: [{
													server_id: server_id
												},
												{
													shop_id: shop_id
												},
												{
													date: {
														"$gte": first_time,
														"$lte": last_time
													}
												}
											]
										}
									},
									{
										$group: {
											_id: {
												product_id: "$product_id",
												shop_id: "$shop_id",
												server_id: "$server_id",
												money_type: "$money_type",
												money_cost: "$money_cost",
												money_id: "$money_id"
											},
											count: {
												$sum: 1
											}
										}
									},
								]).toArray(function(err, results) {
									if (err) {
										console.log('error:' + err);
										return;
									} else {
										results.forEach(item => {
											money_consume += item._id.money_cost
										});
										results.forEach(item => {
											let obj = {
												product_name: map3.get(item._id.product_id),
												server_id: item._id.server_id,
												shop_type: map2.get(item._id.shop_id),
												money_type: item._id.money_type,
												money_cost: item._id.money_cost,
												gm_count: item.count,
												money_consume: (item._id.money_cost / money_consume).toFixed(7)
											};
											arr.push(obj);
											arr.sort((a, b) => {
												return a.gm_count < b.gm_count ? 1 : -1
											});
										});
										res.send({
											code: 200,
											msg: "success",
											result: arr,
										})
									}
								})
							} else if (shop_id === 5001) {
								shopbuy.aggregate([{
										$match: {
											$and: [{
												server_id: server_id
											}, {
												shop_id: shop_id
											}, {
												date: {
													"$gte": first_time,
													"$lte": last_time
												}
											}]
										}
									},
									{
										$group: {
											_id: {
												product_id: "$product_id",
												shop_id: "$shop_id",
												server_id: "$server_id",
												money_type: "$money_type",
												money_cost: "$money_cost",
												money_id: "$money_id"
											},
											count: {
												$sum: 1
											}
										}
									},
								]).toArray(function(err, results) {
									if (err) {
										console.log('error:' + err);
										return;
									} else {
										results.forEach(item => {
											money_consume += item._id.money_cost
										});
										results.forEach(item => {
											let obj = {
												product_name: map3.get(item._id.product_id),
												server_id: item._id.server_id,
												shop_type: map2.get(item._id.shop_id),
												money_type: item._id.money_type,
												money_cost: item._id.money_cost,
												gm_count: item.count,
												money_consume: (item._id.money_cost / money_consume).toFixed(7)
											};
											arr.push(obj);
											arr.sort((a, b) => {
												return a.gm_count < b.gm_count ? 1 : -1
											});
										});
										res.send({
											code: 200,
											msg: "success",
											result: arr,
										})
									}
								})
							} else if (shop_id === 6001) {
								shopbuy.aggregate([{
										$match: {
											$and: [{
												server_id: server_id
											}, {
												shop_id: shop_id
											}, {
												date: {
													"$gte": first_time,
													"$lte": last_time
												}
											}]
										}
									},
									{
										$group: {
											_id: {
												product_id: "$product_id",
												shop_id: "$shop_id",
												server_id: "$server_id",
												money_type: "$money_type",
												money_cost: "$money_cost",
												money_id: "$money_id"
											},
											count: {
												$sum: 1
											}
										}
									},
								]).toArray(function(err, results) {
									if (err) {
										console.log('error:' + err);
										return;
									} else {
										results.forEach(item => {
											money_consume += item._id.money_cost
										});
										results.forEach(item => {
											let obj = {
												product_name: map3.get(item._id.product_id),
												server_id: item._id.server_id,
												shop_type: map2.get(item._id.shop_id),
												money_type: item._id.money_type,
												money_cost: item._id.money_cost,
												gm_count: item.count,
												money_consume: (item._id.money_cost / money_consume).toFixed(7)
											};
											arr.push(obj);
											arr.sort((a, b) => {
												return a.gm_count < b.gm_count ? 1 : -1
											});
										});
										res.send({
											code: 200,
											msg: "success",
											result: arr,
										})
									}
								})
							} else {
								return;
							}
						}
					})
				}
			});
		}
	});
});

//付费角色排行查询
router.post("/feeroleph", (req, res) => {
	let first_time = parseInt(req.body.first_time);
	let last_time = parseInt(req.body.last_time);
	let server_id = parseInt(req.body.server_id);
	let arr = [];
	let obj = {};
	connect(function(err, db) {
		if (err) {
			console.log("数据库连接失败");
		} else {
			let recharge = db.collection("recharge");
			recharge.aggregate([{
					$match: {
						$and: [{
							server_id: server_id
						}, {
							date: {
								"$gte": first_time,
								"$lte": last_time
							}
						}]
					}
				},
				{
					$lookup: {
						from: 'userinfo',
						localField: 'uid',
						foreignField: 'uid',
						as: 'ur'
					}
				},
				{
					$project: {
						_id: 0,
						"uid": 1,
						"dollar": 1,
						"server_id": 1,
						"ur.total_recharge": 1,
						"ur.uid": 1,
						"ur.nickname": 1,
						"ur.user_level": 1,
						"ur.vip_level": 1,
						"ur.reg_time": 1,
						"ur.login_time": 1,
						"ur.server_id": 1,
						"ur.afkcheckpoint":1
					}
				},
			]).toArray(function(err, result) {
				if (err) {
					console.log(err);
					return;
				} else {
					let newArr = [];
					result.forEach(el => {
						const result = newArr.findIndex(ol => {
							return el.uid === ol.uid;
						});
						if (result !== -1) {
							newArr[result].dollar = newArr[result].dollar + el.dollar;
						} else {
							newArr.push(el);
						}
					});
					newArr.forEach(item => {
						item.ur.forEach(items => {
							if (items.server_id === server_id) {
								obj = {
									dollar: parseFloat(item.dollar.toFixed(2)),
									total_recharge: parseFloat(items.total_recharge.toFixed(2)),
									server_id: item.server_id,
									uid: items.uid,
									nickname: items.nickname,
									user_level: items.user_level,
									vip_level: items.vip_level,
									reg_time: items.reg_time,
									login_time: items.login_time,
									checkpoint_id:items.afkcheckpoint,
								};
							} else {
								return;
							}
							arr.push(obj);
							arr.sort((a, b) => {
								return a.dollar < b.dollar ? 1 : -1;
							});
						})
					});
					res.send({
						code: 200,
						msg: "success",
						result: arr
					})
				}
			})
		}
	})
});

//龙平衡
router.post("/dragonbalance",(req,res)=>{
	let server_id=req.body.server_id;
	let last_time=req.body.last_time;
	let first_time=req.body.first_time;
	let fighting=req.body.fighting;
	let high_power=req.body.high_power;
	let low_power=req.body.low_power;
	let arena=req.body.arena;
	res.send({server_id,low_power,last_time,fighting,first_time,high_power,arena})
});

//激活码
router.post("/activationcode",(req,res)=>{
	let server_id=req.body.server_id;
	let first_time=req.body.first_time;
	let last_time=req.body.last_time;
	res.send({server_id,first_time,last_time})
});

//物品流水
router.post("/rolegift",(req,res)=>{
	let server_id=req.body.server_id;
	let first_time=req.body.first_time;
	let last_time=req.body.last_time;
	res.send({server_id,first_time,last_time})
});

//公告
router.post("/notice",(req,res)=>{
	let notice_title=req.body.notice_title;
	res.send({notice_title});
});

//跑马灯
router.post("/pmd",(req,res)=>{
	let pmd_title=req.body.pmd_title;
	res.send({pmd_title});
});

//邮件
router.post("/mail",(req,res)=>{
	let mail=req.body.mail;
	res.send({mail});
});

//封禁
router.post("/ban",(req,res)=>{
	let player_id=req.body.player_id;
	res.send({player_id});
});

//获取oss服务内容
router.post("/getoss",(req,res)=>{
	if(req.body.banben==="安卓测试服"){
		const client = new OSS({
			region: 'oss-cn-hongkong',
			accessKeyId: '',
			accessKeySecret: '',
			bucket: 'sd-android',
		});
		async function getBuffer () {
			try {
				let result = await client.get('Debug/notice.json');
				res.send({
					code:200,
					msg:"获取成功",
					result:result.content.toString()
				});
			} catch (e) {
				console.log(e);
			}
		}
		getBuffer();
	}else if(req.body.banben==="安卓正式服"){
		const client = new OSS({
			region: 'oss-cn-hongkong',
			accessKeyId: '',
			accessKeySecret: '',
			bucket: 'sd-android',
		});
		async function getBuffer () {
			try {
				let result = await client.get('Release/notice.json');
				res.send({
					code:200,
					msg:"获取成功",
					result:result.content.toString()
				});
			} catch (e) {
				console.log(e);
			}
		}
		getBuffer();
	}else if(req.body.banben==="ios正式服"){
		const client = new OSS({
			region: 'oss-cn-hongkong',
			accessKeyId: '',
			accessKeySecret: '',
			bucket: 'sd-ios',
		});
		async function getBuffer () {
			try {
				let result = await client.get('Release/notice.json');
				res.send({
					code:200,
					msg:"获取成功",
					result:result.content.toString()
				});
			} catch (e) {
				console.log(e);
			}
		}
		getBuffer();
	}else if(req.body.banben==="安卓临时正式服"){
		const client = new OSS({
			region: 'oss-us-west-1',
			accessKeyId: '',
			accessKeySecret: '',
			bucket: 'usa-android-release',
		});
		async function getBuffer () {
			try {
				let result = await client.get('notice.json');
				res.send({
					code:200,
					msg:"获取成功",
					result:result.content.toString()
				});
			} catch (e) {
				console.log(e);
			}
		}
		getBuffer();
	}else if(req.body.banben==="安卓临时测试服"){
		const client = new OSS({
			region: 'oss-us-west-1',
			accessKeyId: '',
			accessKeySecret: '',
			bucket: 'usa-android-debug',
		});
		async function getBuffer () {
			try {
				let result = await client.get('notice.json');
				res.send({
					code:200,
					msg:"获取成功",
					result:result.content.toString()
				});
			} catch (e) {
				console.log(e);
			}
		}
		getBuffer();
	}

});

//保存到oss
router.post("/saveoss",(req,res)=>{
	if(req.body.banben==="安卓测试服"){
		let client = new OSS({
			region: 'oss-cn-hongkong',
			accessKeyId: '',
			accessKeySecret: '',
			bucket: 'sd-android',
		});
		let noticejson=req.body.notice;
		let notice=Buffer.from(noticejson);
		fs.writeFile('user/notice.json',notice,function(err){
			if(err){
				console.error(err);
			}
			async function append () {
				try {
					await client.put('Debug/notice.json', 'user/notice.json');
				} catch (e) {
					console.log(e);
				}
			}
			append();
			res.status(200).end("success");
		});
	}else if(req.body.banben==="安卓正式服"){
		let client = new OSS({
			region: 'oss-cn-hongkong',
			accessKeyId: '',
			accessKeySecret: '',
			bucket: 'sd-android',
		});
		let noticejson=req.body.notice;
		let notice=Buffer.from(noticejson);
		fs.writeFile('user/notice.json',notice,function(err){
			if(err){
				console.error(err);
			}
			async function append () {
				try {
					await client.put('Release/notice.json', 'user/notice.json');
				} catch (e) {
					console.log(e);
				}
			}
			append();
			res.status(200).end("success");
		});
	}else if(req.body.banben==="安卓临时测试服"){
		let client = new OSS({
			region: 'oss-us-west-1',
			accessKeyId: '',
			accessKeySecret: '',
			bucket: 'usa-android-debug',
		});
		let noticejson=req.body.notice;
		let notice=Buffer.from(noticejson);
		fs.writeFile('user/notices.json',notice,function(err){
			if(err){
				console.error(err);
			}
			async function append () {
				try {
					await client.put('notice.json', 'user/notices.json');
				} catch (e) {
					console.log(e);
				}
			}
			append();
			res.status(200).end("success");
		});
	}else if(req.body.banben==="安卓临时正式服"){
		let client = new OSS({
			region: 'oss-us-west-1',
			accessKeyId: '',
			accessKeySecret: '',
			bucket: '',
		});
		let noticejson=req.body.notice;
		let notice=Buffer.from(noticejson);
		fs.writeFile('user/notices.json',notice,function(err){
			if(err){
				console.error(err);
			}
			async function append () {
				try {
					await client.put('notice.json', 'user/notices.json');
				} catch (e) {
					console.log(e);
				}
			}
			append();
			res.status(200).end("success");
		});
	}else if(req.body.banben==="ios正式服"){
		let client = new OSS({
			region: 'oss-cn-hongkong',
			accessKeyId: '',
			accessKeySecret: '',
			bucket: 'sd-ios',
		});
		let noticejson=req.body.notice;
		let notice=Buffer.from(noticejson);
		fs.writeFile('user/notice.json',notice,function(err){
			if(err){
				console.error(err);
			}
			async function append () {
				try {
					await client.put('notice.json', 'user/notice.json');
				} catch (e) {
					console.log(e);
				}
			}
			append();
			res.status(200).end("success");
		});
	}
});
module.exports = router;
