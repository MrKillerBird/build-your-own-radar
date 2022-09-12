const ErrorPage = function(exception, type) {
    if(sessionStorage.getItem("finalHandler") != null){sessionStorage.removeItem("finalHandler");}
    let exceptionObject = {name: exception.name, message: exception.message, type: type, stack: exception.stack}
    sessionStorage.setItem("exception", JSON.stringify(exceptionObject))
    window.location.assign(window.location.origin + "/error.html")
}
module.exports = ErrorPage