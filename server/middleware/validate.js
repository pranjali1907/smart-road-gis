const { z } = require('zod');

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const signupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, digits, or underscores'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  role: z.enum(['user', 'admin', 'superadmin']).optional().default('user'),
});

const roadSchema = z.object({
  name: z.string().optional().default(''),
  fromChainage: z.number().optional().default(0),
  toChainage: z.number().optional().default(0),
  length: z.number().optional().default(0),
  width: z.number().optional().default(0),
  roadType: z.string().optional().default(''),
  contractor: z.string().optional().default(''),
  constructionDate: z.string().optional().default(''),
  maintenanceDate: z.string().optional().default(''),
  lastRepair: z.string().optional().default(''),
  surfaceMaterial: z.string().optional().default(''),
  drainageType: z.string().optional().default(''),
  zone: z.string().optional().default(''),
  wardNo: z.string().optional().default(''),
  status: z.string().optional().default('Good'),
  remarks: z.string().optional().default(''),
  geometry: z.any().optional(),
  datasetId: z.number().optional(),
});

const historySchema = z.object({
  roadId: z.string().optional().default(''),
  roadName: z.string().optional().default(''),
  fieldName: z.string().optional().default(''),
  oldValue: z.string().optional().default(''),
  newValue: z.string().optional().default(''),
  editedBy: z.string().optional().default(''),
  datasetId: z.number().optional(),
});

function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.errors.map(e => e.message).join(', ');
        return res.status(400).json({ error: message });
      }
      return res.status(400).json({ error: 'Invalid request data' });
    }
  };
}

module.exports = { validate, loginSchema, signupSchema, roadSchema, historySchema };
