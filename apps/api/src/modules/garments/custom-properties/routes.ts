import type { ApiServer } from '../../../app/server.js';

import type { SessionService } from '../../auth/session.js';

import { registerCustomPropertyDefinitionRoutes } from './definitions.js';
import { registerCustomPropertyValueRoutes } from './values.js';

export { validatePropertyValue } from './validation.js';

export function registerCustomPropertyRoutes(app: ApiServer, session: SessionService) {
  registerCustomPropertyDefinitionRoutes(app, session);
  registerCustomPropertyValueRoutes(app, session);
}
