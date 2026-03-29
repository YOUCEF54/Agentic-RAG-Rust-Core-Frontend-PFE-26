import axios from 'axios';

const engineApi = axios.create({
  baseURL:
    import.meta.env.VITE_ENGINE_API_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:8000',
  timeout: 120000
});

export default engineApi;
