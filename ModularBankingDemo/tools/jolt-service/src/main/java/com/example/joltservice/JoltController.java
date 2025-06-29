package com.example.joltservice;

import com.bazaarvoice.jolt.Chainr;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class JoltController {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostMapping(value = "/transform", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Object transform(@RequestBody Map<String, Object> body) throws Exception {
        Object input = body.get("input");
        Object spec = body.get("spec");
        if (input == null || spec == null) {
            throw new IllegalArgumentException("Both 'input' and 'spec' must be provided");
        }
        // Convert spec to Chainr spec
        List<Object> chainrSpec = objectMapper.convertValue(spec, List.class);
        Chainr chainr = Chainr.fromSpec(chainrSpec);
        Object output = chainr.transform(input);
        return output;
    }
} 