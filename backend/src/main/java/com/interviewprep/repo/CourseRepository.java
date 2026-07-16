package com.interviewprep.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.interviewprep.model.Course;

public interface CourseRepository extends JpaRepository<Course, UUID> {
    Optional<Course> findByUserIdAndName(UUID userId, String name);

    List<Course> findByUserIdAndArchivedOrderByNameAsc(UUID userId, boolean archived);
}
