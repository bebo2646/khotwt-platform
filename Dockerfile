FROM php:8.4-cli-alpine

# Install system packages
RUN apk add --no-cache \
    curl \
    git \
    libpng-dev \
    libxml2-dev \
    zip \
    unzip \
    postgresql-dev \
    icu-dev

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_pgsql bcmath intl

# Install Composer
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www

# Copy backend files if built from repo root
COPY backend/ .

# Run composer install
RUN composer install --no-interaction --optimize-autoloader --no-dev

# Generate storage link
RUN php artisan storage:link --force

# Expose port
EXPOSE 8000

# Start script
CMD php artisan migrate --force && php artisan optimize && php artisan serve --host=0.0.0.0 --port=$PORT
