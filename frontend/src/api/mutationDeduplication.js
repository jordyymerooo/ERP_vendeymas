import axios from 'axios';

const mutationMethods = new Set(['post', 'put', 'patch', 'delete']);

function normalize(data) {
  if (Array.isArray(data)) return data.map(normalize);
  if (data instanceof Date) return data.toJSON();
  if (data && typeof data === 'object') {
    return Object.fromEntries(Object.keys(data).sort().map((key) => [key, normalize(data[key])]));
  }
  return data;
}

async function fingerprint(data) {
  if (data instanceof FormData) {
    return Promise.all([...data].map(async ([key, value]) => [
      key,
      typeof value === 'string' ? value : [
        value.name, value.type, value.size,
        // The bytes distinguish different uploads with identical names and sizes.
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(value);
        }),
      ],
    ]));
  }
  if (data instanceof URLSearchParams) return [...data];
  return normalize(data ?? {});
}

export function installMutationDeduplication(client) {
  const inFlightMutations = new Map();

  client.interceptors.request.use(async (config) => {
    const method = config.method?.toLowerCase();
    if (!mutationMethods.has(method)) return config;

    const url = client.getUri(config);
    const key = method + '|' + url + '|' + JSON.stringify(await fingerprint(config.data));
    if (inFlightMutations.has(key)) {
      throw { isDuplicateBlocked: true, message: 'Operación en curso, por favor espere...' };
    }

    const owner = Symbol();
    inFlightMutations.set(key, owner);
    config.mutationGuard = { key, owner };

    // Serialization can throw before Axios attaches the request config to the error.
    const transforms = [config.transformRequest].flat().filter(Boolean);
    config.transformRequest = transforms.map((transform) => function (...args) {
      try {
        return transform.apply(this, args);
      } catch (error) {
        release(config);
        throw error;
      }
    });
    return config;
  });

  function release(config) {
    const guard = config?.mutationGuard;
    if (guard && inFlightMutations.get(guard.key) === guard.owner) {
      inFlightMutations.delete(guard.key);
    }
  }

  client.interceptors.response.use(
    (response) => {
      release(response.config);
      return response;
    },
    (error) => {
      release(error.config);
      if (error.response?.status === 409 && error.response?.data?.isDuplicateBlocked === true) {
        error.isDuplicateBlocked = true;
      }
      return Promise.reject(error);
    },
  );
}
