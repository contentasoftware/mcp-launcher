# Dockerfile for the Glama listing of contentasoftware/contentasoft-cad-converter-plugin (paste into Glama's server settings).
# The launcher needs no build step; on Linux it serves its get_started tool, which answers introspection.
FROM node:22-alpine
RUN npm install -g @contentasoft/cad-converter-mcp@1.0.0
ENTRYPOINT ["cad-converter-mcp"]
