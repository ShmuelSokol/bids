-- dbo.container_4_view



/* view container_4_view: add view */


/* view container_4_view: add view */


/* view container_4_view: add view */

/* view container_4_view: add view */


/* view container_4_view: add view */


/* view container_4_view: add view */


/* view container_4_view: add view */


/* view container_4_view: add view */


/* view container_4_view: add view */


/* view container_4_view: add view */
/* view container_4_view: add view 
 view container_4_view: add view 
 view container_4_view: add view 
 view container_4_view: add view 
 view container_4_view: add view 
 view container_4_view: add view 
 view container_4_view: add view 
 view container_4_view: add view */
CREATE VIEW [dbo].[container_4_view]
AS
SELECT        dbo.job_line_2_view.cntrct_k79, dbo.job_line_2_view.rel_no_k80, dbo.job_line_2_view.clinno_k81, dbo.job_line_2_view.shpnum_kaj, dbo.job_line_2_view.packed_kaj, dbo.job_line_2_view.shptme_kaj, 
                         dbo.job_line_2_view.shpsta_kaj, dbo.job_line_2_view.idnkaj_kaj, dbo.container_3_view.soctbl_kaw, dbo.container_3_view.x_rhex_kaz, dbo.container_3_view.idnkaw_kaw, dbo.job_line_2_view.piidno_k80
FROM            dbo.job_line_2_view INNER JOIN
                         dbo.container_3_view ON dbo.job_line_2_view.idnkaj_kaj = dbo.container_3_view.idnsoc_kaw
WHERE        (dbo.container_3_view.soctbl_kaw = 'kaj')










