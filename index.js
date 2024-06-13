const OpenAI = require('openai');
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const passport = require('passport');
const session = require('express-session');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { sequelize, User } = require('./db');
const { sequelize: sequelizeChatbot, Message } = require('./db_chatbot');

const app = express();
const port = 3000;


// Configurar CORS para permitir solicitudes con credenciales desde un origen específico
app.use(cors({
    origin: 'http://127.0.0.1:5500', // Asegúrate de que esta URL coincida exactamente con el origen de tus solicitudes
    credentials: true
}));


// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'secretKey', // Cambia esto a una clave secreta real en producción
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

require('./passport-config')(passport);

const openai = new OpenAI({
    apikey: process.env.OPENAI_API_KEY
});

let messages = [
    { role: 'system', content: "Eres un experto en videojuegos." }
];

async function open(userId, input) {
    let userResponse = input;

    // Guardar el mensaje del usuario
    await Message.create({ userId, role: 'user', content: userResponse });

    messages.push({ role: 'user', content: userResponse });

    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages
    });

    const assistantMessage = completion.choices[0].message.content;

    // Guardar el mensaje del asistente
    await Message.create({ userId, role: 'assistant', content: assistantMessage });

    messages.push({ role: 'assistant', content: assistantMessage });

    return messages;
}
// async function open(input) {
//     let userResponce = input;

//     messages.push({ role: 'user', content: userResponce });

//     const completion = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: messages
//     });

//     messages.push({ role: 'assistant', content: completion.choices[0].message.content });

//     return messages;
// }


// Verificación de conexión a la base de datos y sincronización
sequelize.authenticate()
    .then(() => {
        console.log('Connection with user database has been established successfully.');
    })
    .catch(err => {
        console.error('Unable to connect to the user database:', err);
    });

sequelize.sync().then(() => {
    console.log('Database synced');
}).catch(err => {
    console.error('Error syncing database', err);
});

sequelizeChatbot.authenticate()
    .then(() => {
        console.log('Chatbot database connection has been established successfully.');
    })
    .catch(err => {
        console.error('Unable to connect to the chatbot database:', err);
    });

sequelizeChatbot.sync()
    .then(() => {
        console.log('Chatbot database synced');
    })
    .catch(err => {
        console.error('Error syncing chatbot database', err);
    });


// Authentication routes
app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err); }
        if (!user) { 
            return res.status(400).json({ success: false, message: 'Invalid email or password' }); 
        }
        req.logIn(user, (err) => {
            if (err) { return next(err); }
            // Aquí vamos a enviar el ID del usuario en lugar de una cookie de sesión
            return res.json({ success: true, userId: user.id });
        });
    })(req, res, next);
});

app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const user = await User.create({ email, password: hashedPassword });
        res.json({ success: true, userId: user.id }); // Retornar el userId
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            res.json({ success: false, message: 'User already exists' });
        } else {
            res.json({ success: false, message: 'Error registering user' });
        }
    }
});

// app.post('/api/register', async (req, res) => {
//     const { email, password } = req.body;
//     try {
//         const hashedPassword = await bcrypt.hash(password, saltRounds);
//         const user = await User.create({ email, password: hashedPassword });
//         res.json({ success: true });
//     } catch (err) {
//         if (err.name === 'SequelizeUniqueConstraintError') {
//             res.json({ success: false, message: 'User already exists' });
//         } else {
//             res.json({ success: false, message: 'Error registering user' });
//         }
//     }
// });

app.post('/api/chat', async (req, res) => {
    const { userId, input } = req.body;

    // Verificar que el userId sea válido
    const user = await User.findByPk(userId);
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    let response = await open(userId, input);
    res.json({
        "Conversation": response
    });
});

app.get('/api/conversation/:userId', async (req, res) => {
    const { userId } = req.params;

    const messages = await Message.findAll({ where: { userId }, order: [['timestamp', 'ASC']] });

    res.json(messages);
});
// app.post('/api/chat', async (req, res) => {
//     const { userId, input } = req.body;

//     // Verificar que el userId sea válido
//     const user = await User.findByPk(userId);
//     if (!user) {
//         return res.status(401).json({ message: 'Unauthorized' });
//     }

//     let response = await open(input);
//     res.json({
//         "Conversation": response
//     });
// });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/landing.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

module.exports = app;


// const OpenAI = require('openai');
// require('dotenv').config();
// const express = require('express');
// const bodyParser = require('body-parser');
// const cors = require('cors');
// const path = require('path');
// const passport = require('passport');
// const session = require('express-session');
// const bcrypt = require('bcrypt');
// const saltRounds = 10;
// const { sequelize, User } = require('./db');

// const app = express();
// const port = 3000;

// // Configurar CORS para permitir solicitudes con credenciales desde un origen específico
// app.use(cors({
//     origin: 'http://127.0.0.1:5500', // Cambia esto a la URL desde donde estás haciendo las solicitudes
//     credentials: true
// }));

// // Middleware
// app.use(bodyParser.json());
// app.use(express.static(path.join(__dirname, 'public')));
// app.use(session({
//     secret: 'secretKey', // Cambia esto a una clave secreta real en producción
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//         secure: false, // Asegúrate de que sea false si no usas HTTPS
//         httpOnly: true, // Asegura que la cookie no sea accesible vía JavaScript del lado del cliente
//         sameSite: 'lax' // Configuración recomendada para CORS y sesiones
//     }
// }));
// app.use(passport.initialize());
// app.use(passport.session());

// require('./passport-config')(passport);

// const openai = new OpenAI({
//     apikey: process.env.OPENAI_API_KEY
// });

// let messages = [
//     { role: 'system', content: "Eres un experto en videojuegos." }
// ];

// async function open(input) {
//     let userResponce = input;

//     messages.push({ role: 'user', content: userResponce });

//     const completion = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: messages
//     });

//     messages.push({ role: 'assistant', content: completion.choices[0].message.content });

//     return messages;
// }

// // Verificación de conexión a la base de datos y sincronización
// sequelize.authenticate()
//     .then(() => {
//         console.log('Connection has been established successfully.');
//     })
//     .catch(err => {
//         console.error('Unable to connect to the database:', err);
//     });

// sequelize.sync().then(() => {
//     console.log('Database synced');
// }).catch(err => {
//     console.error('Error syncing database', err);
// });

// // Authentication routes
// app.post('/api/login', (req, res, next) => {
//     console.log('Received login request with body:', req.body);
//     passport.authenticate('local', (err, user, info) => {
//         if (err) { return next(err); }
//         if (!user) { 
//             console.log('Login failed: Invalid email or password');
//             return res.status(400).json({ success: false, message: 'Invalid email or password' }); 
//         }
//         req.logIn(user, (err) => {
//             if (err) { return next(err); }
//             console.log('User logged in:', user);
//             console.log('Session ID after login:', req.sessionID);
//             console.log('Session object after login:', req.session);
//             return res.json({ success: true });
//         });
//     })(req, res, next);
// });

// app.post('/api/register', async (req, res) => {
//     const { email, password } = req.body;
//     try {
//         const hashedPassword = await bcrypt.hash(password, saltRounds);
//         const user = await User.create({ email, password: hashedPassword });
//         res.json({ success: true });
//     } catch (err) {
//         if (err.name === 'SequelizeUniqueConstraintError') {
//             res.json({ success: false, message: 'User already exists' });
//         } else {
//             res.json({ success: false, message: 'Error registering user' });
//         }
//     }
// });

// app.post('/api/chat', async (req, res) => {
//     console.log('Received chat request with body:', req.body);
//     console.log('Session ID:', req.sessionID);
//     console.log('Session object:', req.session);
//     console.log('User authenticated:', req.isAuthenticated());
//     console.log('User:', req.user);

//     if (!req.isAuthenticated()) {
//         console.log('Unauthorized access to chat');
//         return res.status(401).json({ message: 'Unauthorized' });
//     }

//     const input = req.body.input;
//     let response = await open(input);
//     res.json({
//         "Conversation": response
//     });
// });

// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public/landing.html'));
// });

// app.get('/login', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public/login.html'));
// });

// app.get('/chat', (req, res) => {
//     if (!req.isAuthenticated()) {
//         return res.redirect('/login');
//     }
//     res.sendFile(path.join(__dirname, 'public/index.html'));
// });

// app.listen(port, () => {
//     console.log(`Server is running at http://localhost:${port}`);
// });


// // const OpenAI = require('openai');
// // require('dotenv').config();
// // const express = require('express');
// // const bodyParser = require('body-parser');
// // const cors = require('cors');
// // const path = require('path');
// // const passport = require('passport');
// // const session = require('express-session');
// // const { sequelize, User } = require('./db');

// // const app = express();
// // const port = 3000;

// // // Configurar CORS para permitir solicitudes con credenciales desde un origen específico
// // app.use(cors({
// //     origin: 'http://127.0.0.1:5500', // Cambia esto a la URL desde donde estás haciendo las solicitudes
// //     credentials: true
// // }));

// // // Middleware
// // app.use(bodyParser.json());
// // app.use(express.static(path.join(__dirname, 'public')));
// // app.use(session({
// //     secret: 'secretKey', // Cambia esto a una clave secreta real en producción
// //     resave: false,
// //     saveUninitialized: false,
// //     cookie: {
// //         secure: false, // Asegúrate de que sea false si no usas HTTPS
// //         httpOnly: true, // Asegura que la cookie no sea accesible vía JavaScript del lado del cliente
// //         sameSite: 'lax' // Configuración recomendada para CORS y sesiones
// //     }
// // }));
// // app.use(passport.initialize());
// // app.use(passport.session());

// // require('./passport-config')(passport);

// // const openai = new OpenAI({
// //     apikey: process.env.OPENAI_API_KEY
// // });

// // let messages = [
// //     { role: 'system', content: "Eres un experto en videojuegos." }
// // ];

// // async function open(input) {
// //     let userResponce = input;

// //     messages.push({ role: 'user', content: userResponce });

// //     const completion = await openai.chat.completions.create({
// //         model: "gpt-3.5-turbo",
// //         messages: messages
// //     });

// //     messages.push({ role: 'assistant', content: completion.choices[0].message.content });

// //     return messages;
// // }

// // // Verificación de conexión a la base de datos y sincronización
// // sequelize.authenticate()
// //     .then(() => {
// //         console.log('Connection has been established successfully.');
// //     })
// //     .catch(err => {
// //         console.error('Unable to connect to the database:', err);
// //     });

// // sequelize.sync().then(() => {
// //     console.log('Database synced');
// // }).catch(err => {
// //     console.error('Error syncing database', err);
// // });

// // // Authentication routes
// // app.post('/api/login', (req, res, next) => {
// //     console.log('Received login request with body:', req.body);
// //     passport.authenticate('local', (err, user, info) => {
// //         if (err) { return next(err); }
// //         if (!user) { 
// //             console.log('Login failed: Invalid email or password');
// //             return res.status(400).json({ success: false, message: 'Invalid email or password' }); 
// //         }
// //         req.logIn(user, (err) => {
// //             if (err) { return next(err); }
// //             console.log('User logged in:', user);
// //             return res.json({ success: true });
// //         });
// //     })(req, res, next);
// // });

// // const bcrypt = require('bcrypt');
// // const saltRounds = 10;

// // app.post('/api/register', async (req, res) => {
// //     const { email, password } = req.body;
// //     try {
// //         const hashedPassword = await bcrypt.hash(password, saltRounds);
// //         const user = await User.create({ email, password: hashedPassword });
// //         res.json({ success: true });
// //     } catch (err) {
// //         if (err.name === 'SequelizeUniqueConstraintError') {
// //             res.json({ success: false, message: 'User already exists' });
// //         } else {
// //             res.json({ success: false, message: 'Error registering user' });
// //         }
// //     }
// // });

// // // app.post('/api/register', async (req, res) => {
// // //     console.log('Received register request with body:', req.body);
// // //     const { email, password } = req.body;
// // //     console.log('Email:', email);
// // //     console.log('Password:', password);
// // //     try {
// // //         const user = await User.create({ email, password });
// // //         console.log('User created:', user);
// // //         res.json({ success: true });
// // //     } catch (err) {
// // //         console.error('Error:', err);
// // //         if (err.name === 'SequelizeUniqueConstraintError') {
// // //             res.json({ success: false, message: 'User already exists' });
// // //         } else {
// // //             res.json({ success: false, message: 'Error registering user' });
// // //         }
// // //     }
// // // });

// // app.post('/api/chat', async (req, res) => {
// //     console.log('Received chat request with body:', req.body);
// //     console.log('Session ID:', req.sessionID);
// //     console.log('User authenticated:', req.isAuthenticated());
// //     console.log('User:', req.user);

// //     if (!req.isAuthenticated()) {
// //         console.log('Unauthorized access to chat');
// //         return res.status(401).json({ message: 'Unauthorized' });
// //     }

// //     const input = req.body.input;
// //     let response = await open(input);
// //     res.json({
// //         "Conversation": response
// //     });
// // });

// // // app.post('/api/chat', async (req, res) => {
// // //     console.log('Received chat request with body:', req.body);
// // //     if (!req.isAuthenticated()) {
// // //         console.log('Unauthorized access to chat');
// // //         return res.status(401).json({ message: 'Unauthorized' });
// // //     }
// // //     const input = req.body.input;
// // //     let response = await open(input);
// // //     res.json({
// // //         "Conversation": response
// // //     });
// // // });

// // app.get('/', (req, res) => {
// //     res.sendFile(path.join(__dirname, 'public/landing.html'));
// // });

// // app.get('/login', (req, res) => {
// //     res.sendFile(path.join(__dirname, 'public/login.html'));
// // });

// // app.get('/chat', (req, res) => {
// //     if (!req.isAuthenticated()) {
// //         return res.redirect('/login');
// //     }
// //     res.sendFile(path.join(__dirname, 'public/index.html'));
// // });

// // app.listen(port, () => {
// //     console.log(`Server is running at http://localhost:${port}`);
// // });
