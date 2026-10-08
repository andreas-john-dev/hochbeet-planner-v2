import { z } from 'zod';

// German default messages for schema errors without their own message, like in the services.
z.config(z.locales.de());
