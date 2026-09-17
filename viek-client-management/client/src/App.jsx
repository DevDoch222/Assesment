import { useEffect, useState } from "react";

const API_URL = "http://localhost:4000/api";

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("token")
  );
  const [email, setEmail] = useState(
    "admin@viek.test"
  );
  const [password, setPassword] = useState(
    "password123"
  );
  const [clients, setClients] = useState([]);
  // Initialize to an empty array: an undefined projects state
  // crashed the Projects list on first render (projects.map)
  const [projects, setProjects] = useState([]);
  const [selectedClient, setSelectedClient] =    useState("");
  const [clientName, setClientName] =    useState("");
  const [clientEmail, setClientEmail] =    useState("");
  const [message, setMessage] = useState("");

  async function login(event) {
    event.preventDefault();
    try {
      const response = await fetch(
        `${API_URL}/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email,
            password
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message);
        return;
      }

      localStorage.setItem("token", result.token);
      setToken(result.token);
      setMessage("");
    } catch (error) {
      setMessage("Unable to reach the server. Is the backend running?");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setClients([]);
    setProjects([]);
    setMessage("");
  }

  async function loadClients() {
    try {
      const response = await fetch(
        `${API_URL}/clients`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.status === 401) {
        logout();
        setMessage("Session expired. Please log in again.");
        return;
      }

      const result = await response.json();
      // The API returns the list under "data", not "clients"
      setClients(result.data);
    } catch (error) {
      setMessage("Unable to load clients.");
    }
  }

  async function loadProjects() {
    const url = selectedClient
      ? `${API_URL}/projects?clientId=${selectedClient}`
      : `${API_URL}/projects`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        logout();
        setMessage("Session expired. Please log in again.");
        return;
      }

      const result = await response.json();
      setProjects(result.projects);
    } catch (error) {
      setMessage("Unable to load projects.");
    }
  }

  async function addClient(event) {
    event.preventDefault();

    // Without this Content-Type header the backend's
    // express.json() never parses the body, so name and
    // email arrive undefined and the request fails
    const response = await fetch(
      `${API_URL}/clients`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: clientName,
          email: clientEmail
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message);
      return;
    }

    setMessage("Client added successfully");
    setClientName("");
    setClientEmail("");
    loadClients();
  }

  async function deleteClient(id) {
    const response = await fetch(
      `${API_URL}/clients/${id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const result = await response.json();

    setMessage(result.message);

    if (response.status === 401) {
      logout();
      return;
    }

    if (response.ok) {
      // If the deleted client was selected in the project
      // filter, reset the filter so projects stay consistent
      if (Number(selectedClient) === Number(id)) {
        setSelectedClient("");
      } else {
        loadClients();
        loadProjects();
      }
    }
  }

  useEffect(() => {
    if (token) {
      loadClients();
      loadProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedClient]);

  if (!token) {
    return (
      <div className="container">
        <div className="card">
          <h1>VIEK Client Management</h1>
          <h2>Login</h2>
          <form onSubmit={login}>
            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="Email"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Password"
              required
            />
            <button type="submit">
              Login
            </button>
          </form>
          {message && (
            <p className="message">
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>VIEK Client Management</h1>
        <button onClick={logout}>Log out</button>
      </div>
      <div className="card">
        <h2>Add Client</h2>
        <form onSubmit={addClient}>
          <input
            value={clientName}
            onChange={(e) =>
              setClientName(e.target.value)
            }
            placeholder="Client name"
            required
          />
          <input
            type="email"
            value={clientEmail}
            onChange={(e) =>
              setClientEmail(e.target.value)
            }
            placeholder="Client email"
            required
          />
          <button type="submit">
            Add Client
          </button>
        </form>
        {message && (
          <p className="message">
            {message}
          </p>
        )}
      </div>
      <div className="card">
        <h2>Clients</h2>
        {clients.length === 0 ? (
          <p>No clients found.</p>
        ) : (
          <ul>
            {clients.map((client) => (
              <li key={client.id}>
                <strong>{client.name}</strong>
                <span>{client.email}</span>
                <button
                  onClick={() =>
                    deleteClient(client.id)
                  }
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <h2>Projects</h2>
        <select
          value={selectedClient}
          onChange={(e) =>
            setSelectedClient(e.target.value)
          }
        >
          <option value="">
            All Clients
          </option>
          {clients.map((client) => (
            <option
              key={client.id}
              value={client.id}
            >
              {client.name}
            </option>
          ))}
        </select>
        {projects.length === 0 ? (
          <p>No projects found.</p>
        ) : (
          <ul>
            {projects.map((project) => (
              <li key={project.id}>
                <strong>{project.name}</strong>
                <span>
                  Client ID: {project.clientId}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
