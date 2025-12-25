package com.example.editor;



import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

@Controller
public class FileUploadController {

    private final Path fileStorageLocation = Paths.get("uploads").toAbsolutePath().normalize();

    public FileUploadController() {
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    // ADDED: produces = MediaType.APPLICATION_JSON_VALUE to ensure browser treats it as JSON
    @PostMapping(value = "/upload", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, String>> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            // 1. Clean the filename AND remove spaces
            String originalName = file.getOriginalFilename();
            if (originalName == null) originalName = "file";

            // Replace spaces with underscores
            String cleanName = StringUtils.cleanPath(originalName).replaceAll("\\s+", "_");

            // 2. Save the file
            String fileName = UUID.randomUUID() + "_" + cleanName;
            Path targetLocation = this.fileStorageLocation.resolve(fileName);

            System.out.println("Saving file to: " + targetLocation); // Debug log
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            // 3. Send JSON response
            Map<String, String> response = new HashMap<>();
            response.put("url", "/uploads/" + fileName);
            response.put("name", cleanName); // Send back the clean name

            return ResponseEntity.ok(response);

        } catch (IOException ex) {
            System.err.println("UPLOAD ERROR:");
            ex.printStackTrace();
            return ResponseEntity.status(500).body(Collections.singletonMap("error", "Failed to upload"));
        }
    }
}

