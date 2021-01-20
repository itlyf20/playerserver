var formatDate=function(now) {
    var year=now.getFullYear();
    var month=now.getMonth()+1;
    var date=now.getDate();
    return  year + '-' + add0(month) + '-' + add0(date);
};

function add0(m) {
    return m < 10 ? '0' + m : m;
}

exports.formatDate=formatDate;

