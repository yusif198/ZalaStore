package com.vortex.zala.zalastore.api;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class StoreApiExceptionHandler {
	@ExceptionHandler(ResponseStatusException.class)
	public ResponseEntity<ProblemDetail> handleBusinessError(ResponseStatusException exception) {
		HttpStatusCode status = exception.getStatusCode();
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, exception.getReason());
		problem.setTitle("Sorğu icra olunmadı");
		return ResponseEntity.status(status).body(problem);
	}
}
