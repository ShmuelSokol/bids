-- dbo.bom_ver_view_1



/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */

/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */


/* view bom_ver_view_1: add view */
CREATE VIEW [dbo].[bom_ver_view_1]
AS
SELECT     dbo.kd2_tab.adtime_kd2, dbo.kd2_tab.uptime_kd2, dbo.kd2_tab.bverno_kd2, dbo.kd2_tab.bv_num_kd2, dbo.kd2_tab.bvdesc_kd2, dbo.kd2_tab.bvstat_kd2, 
                      dbo.k72_tab.idnk72_k72, dbo.k72_tab.uptime_k72, dbo.k72_tab.upname_k72, dbo.kd2_tab.idnk71_kd2, dbo.k72_tab.idnnha_k72, dbo.k72_tab.idncmp_k72, 
                      dbo.k72_tab.seq_no_k72, dbo.k72_tab.itemno_k72, dbo.k72_tab.cmpqty_k72, dbo.k72_tab.qtyper_k72, dbo.kd2_tab.idnkd2_kd2
FROM         dbo.kd2_tab INNER JOIN
                      dbo.k72_tab ON dbo.kd2_tab.idnkd2_kd2 = dbo.k72_tab.idnkd2_k72


















