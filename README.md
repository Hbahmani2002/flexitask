# flexitask-client

# Contribute?
1. Fork this repository your account
2. Clone repository to local development environment
3. Install nodejs >= v4.4.3
4. Run following commands to install necessary packages
  <pre>
  npm install -g gulp-cli
  </pre>
5. Run following command to restore npm packages
  <pre>
  npm install
  </pre>
6. Run following task to create optimized assets (css->less conversion,css,js minifications,theme creations, details: http://themeforest.net/item/remark-responsive-bootstrap-admin-template/11989202)
  <pre>
  gulp dist
  </pre>
7. Create your configuration file to under "public/" directory for overriding default config properties
  <pre>
  config-dev.json
  {
    "base_url":"http://flexitask-backend-url/"
  }
  </pre>
8. Open browser and navigate to "http://flexitask-backend-url/"


# Building
Run build.cmd or following command
<pre>
gulp build --env prod
</pre>

# Linting
<pre>

npm install --save-dev eslint-config-airbnb-base eslint-plugin-import eslint -g
</pre>

# Version compatibility update
<pre>
Web UI with current version works with backend version 1.1.3. Minor update about show project status on project list.isArchived, isPublished, startDate,dueDate etc...
</pre>