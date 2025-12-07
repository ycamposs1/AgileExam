const db = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

exports.findUserByUsername = (username) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM admin WHERE username = ?", [username], (err, row) => {
            if (err) reject(err);
            resolve(row);
        });
    });
};

exports.verifyPassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

exports.createUser = (username, password) => {
    return new Promise(async (resolve, reject) => {
        const hash = await bcrypt.hash(password, 10);
        db.run("INSERT INTO admin (username, password) VALUES (?, ?)", [username, hash], function (err) {
            if (err) reject(err);
            resolve(this.lastID);
        });
    });
};

exports.findUserByEmail = (email) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM admin WHERE email = ?", [email], (err, row) => {
            if (err) reject(err);
            resolve(row);
        });
    });
};

exports.setResetToken = (email, token, expiration) => {
    return new Promise((resolve, reject) => {
        db.run("UPDATE admin SET reset_token = ?, reset_expira = ? WHERE email = ?", [token, expiration, email], (err) => {
            if (err) reject(err);
            resolve(true);
        });
    });
};

exports.findUserByToken = (token) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM admin WHERE reset_token = ?", [token], (err, row) => {
            if (err) reject(err);
            resolve(row);
        });
    });
};

exports.resetPassword = (userId, newPassword) => {
    return new Promise(async (resolve, reject) => {
        const hash = await bcrypt.hash(newPassword, 10);
        db.run("UPDATE admin SET password = ?, reset_token = NULL, reset_expira = NULL WHERE id = ?", [hash, userId], (err) => {
            if (err) reject(err);
            resolve(true);
        });
    });
};
