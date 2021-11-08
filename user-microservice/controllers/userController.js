const User = require('../models/User');
const responseStatus = require('../common/responseStatus');
const clientErrorMessages = require('../common/clientErrors');
const clientSuccessMessages = require('../common/clientSuccess');
const dbErrorMessages = require('../common/dbErrors');
const permissionLevels = require('../common/permissionLevels');
const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const generalErrors = require('../common/generalErrors');

const sendFailureRes = (res, httpStatus, message) => {
	res.status(httpStatus).send({
		status: responseStatus.FAILURE,
		data: {
			message: message
		}
	});
}

const sendSuccessRes = (res, httpStatus, data = undefined) => {
	if (data) {
		res.status(httpStatus).send({
			status: responseStatus.SUCCESS,
			data
		});
		return;
	}
	res.status(httpStatus).send();
}

const hasMissingNameField = (req) => {
	return req.body.name == undefined || req.body.name.length == 0;
}

const hasMissingEmailField = (req) => {
	return req.body.email == undefined || req.body.email.length == 0;
};

const hasMissingPasswordField = (req) => {
	return req.body.password == undefined || req.body.password.length == 0;
};

const hasMissingAuthFields = (req) => {
	return Object.keys(req.body).length == 0;
};

const checkMissingEmailAndPassword = (req, res) => {
	if (hasMissingEmailField(req)) {
		sendFailureRes(res, 400, clientErrorMessages.MISSING_EMAIL);
		return;
	}
	if (hasMissingPasswordField(req)) {
		sendFailureRes(res, 400, clientErrorMessages.MISSING_PASSWORD);
		return;
	}
}

const checkMissingFieldsForAccountCreation = (req, res) => {
	if (hasMissingAuthFields(req)) {
		sendFailureRes(res, 400, clientErrorMessages.MISSING_NAME_EMAIL_PASSWORD);
		return;
	}

	if (hasMissingNameField(req)) {
		sendFailureRes(res, 400, clientErrorMessages.MISSING_NAME);
	}
	return checkMissingEmailAndPassword(req, res);
};

const checkMissingToken = (token, res) => {
	if (!token) {
		sendFailureRes(res, 401, clientErrorMessages.JWT_AUTH_FAILED);
		return;
	}
};


const isPasswordAndUserMatch = (req, res) => {
	const email = req.body.email;
	User.find({ email })
		.then((result) => {
			if (Object.keys(result).length === 0) {
				sendFailureRes(res, 400, clientErrorMessages.INVALID_EMAIL);
				return;
			}

			data = result[0];
			let passwordFields = data.password.split('$');
			let salt = passwordFields[0];
			let hash = crypto.createHmac('sha512', salt).update(req.body.password).digest("base64");
			if (hash == passwordFields[1]) {
				const token = jwt.sign(
					{
						email: email,
						name: data.name,
						permissionLevel: data.permissionLevel
					},
					process.env.SECRET_KEY,
					{
						expiresIn: "7d",
					}
				);
				sendSuccessRes(res, 200, {
					email: email,
					message: clientSuccessMessages.VALID_LOGIN,
					token
				});
				return;
			} else {
				sendFailureRes(res, 400, clientErrorMessages.INVALID_PASSWORD);
				return;
			}
		});
};

exports.create_account = (req, res) => {
	checkMissingFieldsForAccountCreation(req, res);

	const email = req.body.email;
	User.find({ email })
		.then((result) => {
			if (Object.keys(result).length === 0) {
				let salt = crypto.randomBytes(16).toString('base64');
				let hash = crypto.createHmac('sha512', salt).update(req.body.password).digest("base64");
				const password = salt + "$" + hash;
				const name = req.body.name;
				const permissionLevel = permissionLevels.USER;

				const user = new User({
					name,
					email,
					password,
					permissionLevel
				});
				user.save().then((result) => {
					sendSuccessRes(res, 201);
					return;
				});
			} else {
				sendFailureRes(res, 404, clientErrorMessages.USER_EXISTS + email);
				return;
			}
		}).catch((err) => {
			res.status(500).json({
				status: responseStatus.ERROR,
				error_message: dbErrorMessages.WRITE_ERROR(err)
			});
		});
	return;
};

exports.user_login = (req, res) => {
	if (hasMissingAuthFields(req)) {
		sendFailureRes(res, 400, clientErrorMessages.MISSING_EMAIL_AND_PASSWORD);
		return;
	}

	checkMissingEmailAndPassword(req, res);

	return isPasswordAndUserMatch(req, res);
};

exports.jwt_validate = (req, res) => {
	const token = req.header('authorization');
	try {
		checkMissingToken(token, res);

		jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
			if (err) {
				console.log(err);
				sendFailureRes(res, 401, clientErrorMessages.JWT_AUTH_FAILED);
				return;
			}
			req.user = user;
			sendSuccessRes(res, 200, {
				email: user.email,
				name: user.name
			});
			return;
		});
	} catch (error) {
		console.log("3");
		res.status(500).send({
			status: responseStatus.ERROR,
			data: {
				message: generalErrors.JWT_ERROR(error)
			}
		});
	}
}

exports.validate_admin = (req, res) => {
	const token = req.header('authorization');
	try {
		checkMissingToken(token, res);

		jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
			if (err) {
				console.log(err);
				sendFailureRes(res, 401, clientErrorMessages.JWT_AUTH_FAILED);
				return;
			}
			const role = user.permissionLevel;
			console.log(user.permissionLevel);
			if (role === permissionLevels.ADMIN) {
				sendSuccessRes(res, 200);
				return;
			} else {
				sendFailureRes(res, 403, clientErrorMessages.INVALID_ADMIN);
				return;
			}
		});
	} catch (error) {
		res.status(500).send({
			status: responseStatus.ERROR,
			data: {
				message: JWT_ERROR(error)
			}
		});
	}
}

exports.user_logout = (req, res) => { // todo delete
	res.status(200).clearCookie("cs3219_jwt")
	.json({
		status: responseStatus.SUCCESS, 
    	data: {
        	message: clientSuccessMessages.USER_LOGOUT
    	}
    });
};

exports.statusCheck = (req, res) => {
    res.json({
        status: responseStatus.SUCCESS,
        data: {
            message: clientSuccessMessages.STATUS_WORKING + "!!!"
        }
    });
};

exports.load = (req, res) => {
	for (var i = 0; i < 1000000000; i++)  {
		Math.sqrt(i);
	}
    res.json({
        status: responseStatus.SUCCESS,
        data: {
            message: clientSuccessMessages.STATUS_WORKING
        }
    });
};
