-- dbo.customer_1_view



/* view customer_1_view: add view */


/* view customer_1_view: add view */


/* view customer_1_view: add view */

/* view customer_1_view: add view */


/* view customer_1_view: add view */


/* view customer_1_view: add view */


/* view customer_1_view: add view */


/* view customer_1_view: add view */


/* view customer_1_view: add view */
/* view customer_1_view: add view */
CREATE VIEW [dbo].[customer_1_view]
AS
SELECT        dbo.k12_tab.e_code_k12, dbo.k12_tab.e_name_k12, dbo.kdw_tab.c_clas_kdw, dbo.kdw_tab.c_stat_kdw, dbo.kdw_tab.c_cntr_kdw, dbo.kdw_tab.fob_od_kdw, dbo.kdw_tab.q_mode_kdw, dbo.k06_tab.trmdes_k06, 
                         dbo.k12_tab.idnk12_k12, dbo.kdw_tab.idnkdw_kdw, dbo.k06_tab.idnk06_k06, dbo.k31_tab.idnk31_k31, dbo.k31_tab.a_code_k31, dbo.k31_tab.c_code_k31, dbo.k31_tab.c_name_k31
FROM            dbo.k12_tab INNER JOIN
                         dbo.k31_tab ON dbo.k12_tab.idnk12_k12 = dbo.k31_tab.idnk12_k31 INNER JOIN
                         dbo.kdw_tab ON dbo.k31_tab.idnk31_k31 = dbo.kdw_tab.idnk31_kdw INNER JOIN
                         dbo.k06_tab ON dbo.kdw_tab.idnk06_kdw = dbo.k06_tab.idnk06_k06









