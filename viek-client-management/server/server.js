import express from "express";
import cors from "cors";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

const users = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@viek.test",
    password: "password123"
  }
];

let clients = [
  {
    id: 1,
    name: "Acme Limited",
    email: "contact@acme.test"
  },
  {
    id: 2,
    name: "Bright Solutions",
    email: "hello@bright.test"
  }
];

const projects = [
  {
    id: 1,
    name: "Website Development",
    clientId: 1
  },
  {
    id: 2,
    name: "Mobile Application",
    clientId: 2
  },
  {
    id: 3,
    name: "UI/UX Design",
    clientId: 1
  }
];

// Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required"
    });
  }

  const user = users.find(
    (item) =>
      item.email === email &&
      item.password === password
  );

  if (!user) {
    return res.status(401).json({
      message: "Invalid email or password"
    });
  }

  // Never return the password to the client
  const { password: _password, ...safeUser } = user;

  res.json({
    token: "demo-token",
    user: safeUser
  });
});

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader !== "Bearer demo-token") {
    return res.status(401).json({
      message: "Unauthorized"
    });
  }

  next();
}

// Get clients
app.get("/api/clients", authenticate, (req, res) => {
  res.json({
    data: clients
  });
});

// Add client
app.post("/api/clients", authenticate, (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      message: "Name and email are required"
    });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({
      message: "A valid email is required"
    });
  }

  const duplicate = clients.find(
    (client) => client.email.toLowerCase() === email.toLowerCase()
  );
  if (duplicate) {
    return res.status(409).json({
      message: "A client with this email already exists"
    });
  }

  // Generate an id that can never collide with an existing one,
  // even after clients have been deleted
  const nextId = clients.length
    ? Math.max(...clients.map((client) => client.id)) + 1
    : 1;

  const newClient = {
    id: nextId,
    name,
    email
  };

  clients.push(newClient);

  res.status(201).json({
    data: newClient
  });
});

// Delete client
app.delete("/api/clients/:id", authenticate, (req, res) => {
  // req.params values are strings, so the id must be converted
  // to a number before comparing with the numeric client ids
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({
      message: "Client id must be a number"
    });
  }

  const originalLength = clients.length;
  clients = clients.filter(
    (client) => client.id !== id
  );

  if (clients.length === originalLength) {
    return res.status(404).json({
      message: "Client not found"
    });
  }

  res.json({
    message: "Client deleted successfully"
  });
});

// Get projects
app.get("/api/projects", authenticate, (req, res) => {
  // clientId arrives as a query string (string), so it must be
  // converted to a number before comparing with numeric clientIds
  const { clientId } = req.query;

  let result = projects;

  if (clientId) {
    result = projects.filter(
      (project) => project.clientId === Number(clientId)
    );
  }

  res.json({
    projects: result
  });
});

// Handle unknown routes with a JSON 404 instead of an HTML error page
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
