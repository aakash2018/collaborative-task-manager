const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Collaborative Task Manager API',
      version: '1.0.0',
      description: 'A comprehensive API for managing collaborative tasks and projects with real-time updates',
      contact: {
        name: 'API Support',
        email: 'support@taskmanager.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://your-domain.com/api' 
          : 'http://localhost:5000/api',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'User ID'
            },
            name: {
              type: 'string',
              description: 'User name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email'
            },
            avatar: {
              type: 'string',
              description: 'User avatar URL'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Project: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Project ID'
            },
            name: {
              type: 'string',
              description: 'Project name'
            },
            description: {
              type: 'string',
              description: 'Project description'
            },
            owner: {
              $ref: '#/components/schemas/User'
            },
            members: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/User'
              }
            },
            color: {
              type: 'string',
              description: 'Project color in hex format'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Task: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Task ID'
            },
            title: {
              type: 'string',
              description: 'Task title'
            },
            description: {
              type: 'string',
              description: 'Task description'
            },
            status: {
              type: 'string',
              enum: ['todo', 'in-progress', 'done'],
              description: 'Task status'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Task priority'
            },
            assignee: {
              $ref: '#/components/schemas/User'
            },
            project: {
              $ref: '#/components/schemas/Project'
            },
            dueDate: {
              type: 'string',
              format: 'date-time',
              description: 'Task due date'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Task tags'
            },
            createdBy: {
              $ref: '#/components/schemas/User'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Error message'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  msg: {
                    type: 'string'
                  },
                  param: {
                    type: 'string'
                  },
                  location: {
                    type: 'string'
                  }
                }
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./routes/*.js', './server.js']
};

const specs = swaggerJsdoc(options);

const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Task Manager API Documentation'
  }));
};

module.exports = { setupSwagger };
