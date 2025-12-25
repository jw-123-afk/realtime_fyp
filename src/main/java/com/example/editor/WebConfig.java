package com.example.editor;



import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Maps the URL "/uploads/..." to the folder "uploads/" on your server
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:uploads/");
    }
}
